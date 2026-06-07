import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';

/** -1 representa "ilimitado" nos limites do plano. */
const isUnlimited = (limit: number) => limit === -1;

export const getPlanUsage = async (organizationId: string) => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, maxUsers: true, maxChats: true, maxStorageGB: true },
  });
  if (!org) throw new AppError('Organization not found', 404);

  const [users, openChats] = await Promise.all([
    prisma.organizationMember.count({ where: { organizationId, isActive: true } }),
    prisma.chat.count({ where: { organizationId, status: { not: 'CLOSED' } } }),
  ]);

  return {
    plan: org.plan,
    limits: { maxUsers: org.maxUsers, maxChats: org.maxChats, maxStorageGB: org.maxStorageGB },
    usage: { users, openChats },
  };
};

/** Bloqueia a adição de usuário se o limite do plano for atingido. */
export const assertCanAddUser = async (organizationId: string): Promise<void> => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { maxUsers: true },
  });
  if (!org) throw new AppError('Organization not found', 404);

  if (isUnlimited(org.maxUsers)) return;

  const count = await prisma.organizationMember.count({
    where: { organizationId, isActive: true },
  });

  if (count >= org.maxUsers) {
    throw new AppError(
      `Limite de ${org.maxUsers} usuários do plano atingido. Faça upgrade do plano para adicionar mais.`,
      403
    );
  }
};

/** Bloqueia a abertura de novos atendimentos se o limite do plano for atingido. */
export const assertCanAddChat = async (organizationId: string): Promise<void> => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { maxChats: true },
  });
  if (!org) throw new AppError('Organization not found', 404);

  if (isUnlimited(org.maxChats)) return;

  const count = await prisma.chat.count({
    where: { organizationId, status: { not: 'CLOSED' } },
  });

  if (count >= org.maxChats) {
    throw new AppError(
      `Limite de ${org.maxChats} atendimentos abertos do plano atingido. Faça upgrade do plano.`,
      403
    );
  }
};
