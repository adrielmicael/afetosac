import { Request } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';

type AuditParams = {
  action: string; // LOGIN, LOGIN_FAILED, IMPERSONATE, ORG_SUSPEND, PLAN_CHANGE, ...
  targetType?: string; // ORGANIZATION, USER, PLATFORM
  targetId?: string;
  organizationId?: string;
  before?: unknown;
  after?: unknown;
  actorEmail?: string; // usado quando ainda não há req.platformAdmin (ex.: login)
  actorId?: string;
};

const getClientIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
  req.ip ||
  req.socket?.remoteAddress ||
  'unknown';

const toJson = (value: unknown): string | undefined => {
  if (value === undefined) return undefined;
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
};

/**
 * Registra uma ação de plataforma de forma auditável (ator, alvo, antes/depois,
 * IP/userAgent). Best-effort: nunca quebra a requisição principal.
 */
export const recordPlatformAudit = async (
  req: Request,
  params: AuditParams
): Promise<void> => {
  try {
    const actorId = params.actorId ?? req.platformAdmin?.id ?? null;
    const actorEmail = params.actorEmail ?? req.platformAdmin?.email ?? 'unknown';

    await prisma.platformAuditLog.create({
      data: {
        platformAdminId: actorId,
        actorEmail,
        action: params.action,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        organizationId: params.organizationId ?? null,
        before: toJson(params.before) ?? null,
        after: toJson(params.after) ?? null,
        ipAddress: getClientIp(req),
        userAgent: (req.headers['user-agent'] as string) || 'unknown',
      },
    });
  } catch (error) {
    logger.warn('Failed to record platform audit log', error);
  }
};
