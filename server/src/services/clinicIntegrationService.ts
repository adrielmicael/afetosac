import crypto from 'crypto';
import prisma from '../config/database';
import { hashPassword } from '../utils/password';
import { assertCanAddUser } from './planLimitService';
import { logger } from '../utils/logger';

const VALID_ROLES = ['OWNER', 'ADMIN', 'SUPERVISOR', 'AGENT'];

type LinkInput = { email: string; name: string; role?: string };

/**
 * Cria/vincula um usuário do Afeto Clinic a uma organização do SAC.
 * Idempotente: por e-mail (usuário) e por (org, usuário) (membership).
 * Respeita o limite de usuários do plano apenas ao criar um novo membership.
 */
export const linkClinicUser = async (organizationId: string, input: LinkInput) => {
  const email = input.email.trim().toLowerCase();
  const role = input.role && VALID_ROLES.includes(input.role) ? input.role : 'AGENT';

  let user = await prisma.user.findUnique({ where: { email } });
  let createdUser = false;

  if (!user) {
    // Senha aleatória forte — acesso se dá via SSO; pode trocar depois
    const randomPassword = `Af${crypto.randomBytes(12).toString('base64url')}9X`;
    user = await prisma.user.create({
      data: { email, name: input.name, password: await hashPassword(randomPassword) },
    });
    createdUser = true;
  }

  const existingMembership = await prisma.organizationMember.findFirst({
    where: { organizationId, userId: user.id },
  });

  let membershipRole = role;
  let createdMembership = false;

  if (!existingMembership) {
    await assertCanAddUser(organizationId); // enforcement de plano
    await prisma.organizationMember.create({
      data: { organizationId, userId: user.id, role },
    });
    createdMembership = true;
  } else if (!existingMembership.isActive) {
    await prisma.organizationMember.update({
      where: { id: existingMembership.id },
      data: { isActive: true, role },
    });
  } else {
    membershipRole = existingMembership.role; // não rebaixa papel existente
  }

  logger.info(
    `Clinic user linked: ${email} -> org ${organizationId} (createdUser=${createdUser}, createdMembership=${createdMembership})`
  );

  return {
    user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
    role: membershipRole,
    createdUser,
    createdMembership,
  };
};
