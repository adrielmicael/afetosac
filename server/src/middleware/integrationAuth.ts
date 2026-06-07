import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AppError } from './errorHandler';
import prisma from '../config/database';
import { decrypt } from '../utils/crypto';
import { logger } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      integrationOrg?: { id: string; slug: string; externalId: string | null };
    }
  }
}

const MAX_SKEW_MS = 5 * 60 * 1000; // janela anti-replay de 5 minutos

/**
 * Autentica chamadas do Afeto Clinic via HMAC-SHA256 por organização.
 *
 * Headers esperados:
 *   X-Afeto-Tenant     -> externalId do tenant no Afeto Clinic
 *   X-Afeto-Timestamp  -> epoch em ms
 *   X-Afeto-Signature  -> hex de HMAC_SHA256(secret, `${timestamp}.${rawBody}`)
 *
 * O segredo é armazenado cifrado em repouso e nunca trafega.
 */
export const verifyAfetoClinicSignature = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const tenantExternalId = req.headers['x-afeto-tenant'] as string | undefined;
    const timestamp = req.headers['x-afeto-timestamp'] as string | undefined;
    const signature = req.headers['x-afeto-signature'] as string | undefined;

    if (!tenantExternalId || !timestamp || !signature) {
      throw new AppError('Cabeçalhos de integração ausentes', 401);
    }

    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) {
      throw new AppError('Timestamp inválido ou expirado', 401);
    }

    const org = await prisma.organization.findUnique({
      where: { externalId: tenantExternalId },
      select: {
        id: true,
        slug: true,
        externalId: true,
        status: true,
        afetoClinicEnabled: true,
        afetoClinicSecret: true,
      },
    });

    if (!org || org.status !== 'ACTIVE' || !org.afetoClinicEnabled || !org.afetoClinicSecret) {
      throw new AppError('Integração não habilitada para este tenant', 403);
    }

    const secret = decrypt(org.afetoClinicSecret);
    if (!secret) {
      throw new AppError('Segredo de integração indisponível', 500);
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${req.rawBody ?? ''}`)
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      logger.warn(`Assinatura de integração inválida para tenant ${tenantExternalId}`);
      throw new AppError('Assinatura inválida', 401);
    }

    req.integrationOrg = { id: org.id, slug: org.slug, externalId: org.externalId };
    next();
  } catch (error) {
    next(error);
  }
};
