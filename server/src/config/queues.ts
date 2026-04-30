import { Queue, Worker, Job } from 'bullmq';
import { redis } from './redis';
import { addJob as addJobPg } from './jobQueue';
import { logger } from '../utils/logger';
import prisma from './database';

// Se Redis disponível, usa BullMQ
// Se não, usa PostgreSQL (jobQueue)
const useRedis = !!redis;

// Opções padrão: 3 tentativas, backoff exponencial, dead-letter queue
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
};

// Configuração de filas (apenas se Redis disponível)
export let queues: any = {};
export let whatsappWorker: any = null;
export let emailWorker: any = null;
export let mediaWorker: any = null;
export let reportsWorker: any = null;
export let webhooksWorker: any = null;
export let eventsWorker: any = null;

// Registrar falha permanente no banco (dead-letter)
async function recordDeadLetter(queue: string, job: Job, error: Error) {
  try {
    await prisma.activity.create({
      data: {
        organizationId: job.data?.organizationId || 'system',
        userId: 'system',
        type: 'DEAD_LETTER',
        description: `Job ${job.name} na fila ${queue} falhou após ${job.opts.attempts} tentativas`,
        metadata: JSON.stringify({
          jobId: job.id,
          queue,
          payload: job.data,
          error: error.message,
          failedAt: new Date().toISOString(),
        }),
      },
    });
    logger.error(`[DeadLetter] queue=${queue} jobId=${job.id} error=${error.message}`);
  } catch (e) {
    logger.error('[DeadLetter] Failed to record dead-letter:', e);
  }
}

if (useRedis) {
  logger.info('Using Redis for queues (BullMQ)');
  const redisConnection = redis!;
  
  queues = {
    whatsapp: new Queue('whatsapp', { connection: redisConnection }),
    email: new Queue('email', { connection: redisConnection }),
    media: new Queue('media', { connection: redisConnection }),
    reports: new Queue('reports', { connection: redisConnection }),
    webhooks: new Queue('webhooks', { connection: redisConnection }),
    events: new Queue('events', { connection: redisConnection }),
  };

  // Workers...
  whatsappWorker = new Worker('whatsapp', async (job: Job) => {
    const { type, data } = job.data;
    switch (type) {
      case 'SEND_MESSAGE':
        logger.info(`Sending WhatsApp message to ${data.phone}`);
        break;
      case 'SEND_TEMPLATE':
        logger.info(`Sending template ${data.templateName} to ${data.phone}`);
        break;
    }
  }, { connection: redisConnection });
  whatsappWorker.on('failed', (job: Job | undefined, error: Error) => {
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      recordDeadLetter('whatsapp', job, error);
    }
  });

  emailWorker = new Worker('email', async (job: Job) => {
    logger.info(`Sending email to ${job.data.to}`);
  }, { connection: redisConnection });
  emailWorker.on('failed', (job: Job | undefined, error: Error) => {
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      recordDeadLetter('email', job, error);
    }
  });

  mediaWorker = new Worker('media', async (job: Job) => {
    logger.info(`Processing media: ${job.data.type}`);
  }, { connection: redisConnection });

  reportsWorker = new Worker('reports', async (job: Job) => {
    logger.info(`Generating report: ${job.data.type}`);
  }, { connection: redisConnection, concurrency: 2 });

  webhooksWorker = new Worker('webhooks', async (job: Job) => {
    logger.info(`Sending webhook to ${job.data.url}`);
  }, { connection: redisConnection });
  webhooksWorker.on('failed', (job: Job | undefined, error: Error) => {
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      recordDeadLetter('webhooks', job, error);
    }
  });

  eventsWorker = new Worker('events', async (job: Job) => {
    logger.info(`Processing event: ${job.data.type}`);
  }, { connection: redisConnection });

} else {
  logger.info('Using PostgreSQL for queues (fallback)');
}

// Função helper para adicionar jobs (funciona com Redis ou PostgreSQL)
export const addJob = {
  whatsapp: async (type: string, data: any, opts?: any) => {
    if (useRedis) {
      return queues.whatsapp.add(type, { type, data }, { ...DEFAULT_JOB_OPTIONS, ...opts });
    }
    return addJobPg('whatsapp', { type, data });
  },
  
  email: async (type: string, data: any, opts?: any) => {
    if (useRedis) {
      return queues.email.add(type, data, { ...DEFAULT_JOB_OPTIONS, ...opts });
    }
    return addJobPg('email', { type, ...data });
  },
  
  media: async (type: string, data: any, opts?: any) => {
    if (useRedis) {
      return queues.media.add(type, data, { ...DEFAULT_JOB_OPTIONS, ...opts });
    }
    return addJobPg('media', { type, ...data });
  },
  
  report: async (type: string, data: any, opts?: any) => {
    if (useRedis) {
      return queues.reports.add(type, data, { priority: 1, ...DEFAULT_JOB_OPTIONS, ...opts });
    }
    return addJobPg('reports', { type, ...data });
  },
  
  webhook: async (data: any, opts?: any) => {
    if (useRedis) {
      return queues.webhooks.add('WEBHOOK', data, { ...DEFAULT_JOB_OPTIONS, ...opts });
    }
    return addJobPg('webhooks', data);
  },
  
  event: async (type: string, data: any, opts?: any) => {
    if (useRedis) {
      return queues.events.add(type, { type, data }, { ...DEFAULT_JOB_OPTIONS, ...opts });
    }
    return addJobPg('events', { type, ...data });
  },
};

export default { addJob };
