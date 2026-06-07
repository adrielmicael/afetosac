import prisma from '../config/database';
import { logger } from '../utils/logger';

/** Período atual no formato 'YYYY-MM'. */
export const currentPeriod = (date = new Date()): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

const periodRange = (period: string): { start: Date; end: Date } => {
  const [year, month] = period.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
};

/**
 * Calcula e materializa as métricas de uso de uma organização para um período.
 * Alimenta o painel SaaS (Lote 5) e o enforcement de plano (Lote 6).
 */
export const computeUsageForOrg = async (
  organizationId: string,
  period: string = currentPeriod()
) => {
  const { start, end } = periodRange(period);
  const createdInPeriod = { gte: start, lt: end };

  const [messagesIn, messagesOut, chatsTotal, patientsTotal, activeUsers] =
    await Promise.all([
      prisma.message.count({
        where: { sender: 'CLIENT', createdAt: createdInPeriod, chat: { organizationId } },
      }),
      prisma.message.count({
        where: { sender: { in: ['AGENT', 'BOT'] }, createdAt: createdInPeriod, chat: { organizationId } },
      }),
      prisma.chat.count({ where: { organizationId, createdAt: createdInPeriod } }),
      prisma.patient.count({ where: { organizationId, isActive: true } }),
      prisma.organizationMember.count({ where: { organizationId, isActive: true } }),
    ]);

  const data = {
    messagesIn,
    messagesOut,
    chatsTotal,
    patientsTotal,
    activeUsers,
    storageMb: 0, // contabilização de storage entra junto do pipeline de mídia (2.5)
    computedAt: new Date(),
  };

  const metric = await prisma.usageMetric.upsert({
    where: { organizationId_period: { organizationId, period } },
    update: data,
    create: { organizationId, period, ...data },
  });

  return metric;
};

/** Calcula as métricas do período atual para todas as organizações ativas. */
export const computeUsageForAllOrgs = async (period: string = currentPeriod()) => {
  const orgs = await prisma.organization.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });

  let ok = 0;
  for (const org of orgs) {
    try {
      await computeUsageForOrg(org.id, period);
      ok += 1;
    } catch (error) {
      logger.warn(`Failed to compute usage for org ${org.id}`, error);
    }
  }
  logger.info(`Usage computed for ${ok}/${orgs.length} orgs (period ${period})`);
  return { total: orgs.length, ok };
};

export const getUsageForOrg = (organizationId: string, period: string = currentPeriod()) =>
  prisma.usageMetric.findUnique({
    where: { organizationId_period: { organizationId, period } },
  });
