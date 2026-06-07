import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { linkClinicUser } from '../services/clinicIntegrationService';
import { issueSession } from '../services/sessionService';

const getOrgId = (req: Request): string => {
  const id = req.integrationOrg?.id;
  if (!id) throw new AppError('Integration context required', 401);
  return id;
};

/**
 * Provisionamento: cria/vincula um usuário do Afeto Clinic ao tenant no SAC.
 * Idempotente.
 */
export const provisionUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = getOrgId(req);
    const { email, name, role } = req.body;
    if (!email || !name) {
      throw new AppError('email e name são obrigatórios', 400);
    }

    const result = await linkClinicUser(organizationId, { email, name, role });
    res.status(result.createdUser ? 201 : 200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

/**
 * SSO: o Afeto Clinic apresenta uma asserção assinada (validada pelo middleware
 * HMAC). O SAC provisiona/vincula o usuário e emite uma sessão de tenant.
 */
export const ssoExchange = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = getOrgId(req);
    const { email, name, role } = req.body;
    if (!email || !name) {
      throw new AppError('email e name são obrigatórios', 400);
    }

    const linked = await linkClinicUser(organizationId, { email, name, role });
    const session = await issueSession(req, res, linked.user, {
      role: linked.role,
      organizationId,
    });

    logger.info(`SSO Afeto Clinic: ${email} autenticado na org ${organizationId}`);
    res.json({ success: true, token: session.token, user: session.user });
  } catch (error) {
    next(error);
  }
};

/**
 * Sincronização de paciente: upsert por (organizationId, phone). Idempotente.
 */
export const upsertPatient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = getOrgId(req);
    const { name, phone, email, responsible, age, observations, externalId } = req.body;
    if (!name || !phone) {
      throw new AppError('name e phone são obrigatórios', 400);
    }

    // 1) Contato (dono do telefone) — vários pacientes podem compartilhar o número
    const contact = await prisma.contact.upsert({
      where: { organizationId_phone: { organizationId, phone } },
      update: { name: responsible || name },
      create: { organizationId, phone, name: responsible || name },
      select: { id: true },
    });

    // 2) Paciente — identidade pelo id do Clinic (externalId) quando disponível
    const patient = externalId
      ? await prisma.patient.upsert({
          where: { organizationId_externalId: { organizationId, externalId } },
          update: { name, email, responsible, age, observations, phone, contactId: contact.id, isActive: true },
          create: { organizationId, externalId, name, phone, email, responsible, age, observations, contactId: contact.id },
          select: { id: true, name: true, phone: true, email: true },
        })
      : await prisma.patient.create({
          data: { organizationId, name, phone, email, responsible, age, observations, contactId: contact.id },
          select: { id: true, name: true, phone: true, email: true },
        });

    res.json({ success: true, contact: { id: contact.id }, patient });
  } catch (error) {
    next(error);
  }
};
