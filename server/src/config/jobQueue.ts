/**
 * Filas usando PostgreSQL (alternativa ao BullMQ/Redis)
 * Para uso quando Redis não está disponível
 */

import prisma from './database';
import { logger } from '../utils/logger';

interface Job {
  id: string;
  queue: string;
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processedAt?: Date;
}

/**
 * Adicionar job à fila
 */
export const addJob = async (
  queue: string,
  payload: any,
  maxAttempts: number = 3
): Promise<Job> => {
  const job = await prisma.$executeRaw`
    INSERT INTO "JobQueue" (id, queue, payload, status, attempts, "maxAttempts", "createdAt")
    VALUES (
      gen_random_uuid(),
      ${queue},
      ${JSON.stringify(payload)},
      'pending',
      0,
      ${maxAttempts},
      NOW()
    )
    RETURNING *
  `;
  
  logger.info(`Job added to queue ${queue}`);
  return job as any;
};

/**
 * Processar jobs pendentes
 */
export const processJobs = async (queue: string, handler: (payload: any) => Promise<void>) => {
  // Buscar job pendente
  const jobs = await prisma.$queryRaw`
    SELECT * FROM "JobQueue"
    WHERE queue = ${queue}
    AND status = 'pending'
    AND attempts < "maxAttempts"
    ORDER BY "createdAt" ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  `;

  const job = (jobs as any)[0];
  if (!job) return;

  try {
    // Marcar como processando
    await prisma.$executeRaw`
      UPDATE "JobQueue"
      SET status = 'processing', attempts = attempts + 1
      WHERE id = ${job.id}
    `;

    // Executar handler
    await handler(JSON.parse(job.payload));

    // Marcar como completado
    await prisma.$executeRaw`
      UPDATE "JobQueue"
      SET status = 'completed', "processedAt" = NOW()
      WHERE id = ${job.id}
    `;

    logger.info(`Job ${job.id} completed`);
  } catch (error) {
    // Marcar como falho ou reverter para pending
    await prisma.$executeRaw`
      UPDATE "JobQueue"
      SET status = CASE WHEN attempts >= "maxAttempts" THEN 'failed' ELSE 'pending' END
      WHERE id = ${job.id}
    `;

    logger.error(`Job ${job.id} failed:`, error);
  }
};

/**
 * Limpar jobs antigos
 */
export const cleanupJobs = async (olderThanDays: number = 7) => {
  await prisma.$executeRaw`
    DELETE FROM "JobQueue"
    WHERE "createdAt" < NOW() - INTERVAL '${olderThanDays} days'
    AND status IN ('completed', 'failed')
  `;
};

export default { addJob, processJobs, cleanupJobs };
