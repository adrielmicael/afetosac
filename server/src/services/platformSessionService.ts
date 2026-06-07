import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { parseDurationMs } from './sessionService';

export const PLATFORM_COOKIE = 'platform_token';

type PlatformAdminLike = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export type PlatformTokenPayload = {
  id: string;
  email: string;
  role: string;
  jti: string;
  scope: 'platform';
};

export type PlatformChallengePayload = {
  id: string;
  type: 'platform_2fa_challenge';
};

const getClientIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
  req.ip ||
  req.socket?.remoteAddress ||
  'unknown';

const cookieOptions = (maxAgeMs: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: maxAgeMs,
});

/**
 * Emite uma sessão de plataforma: JWT com scope 'platform' + jti, registra
 * PlatformSession, atualiza lastLoginAt e seta o cookie httpOnly dedicado.
 * Sessões de plataforma são intencionalmente curtas.
 */
export const issuePlatformSession = async (
  req: Request,
  res: Response,
  admin: PlatformAdminLike
): Promise<{ token: string; admin: Record<string, unknown> }> => {
  const jti = crypto.randomUUID();
  const expiresIn = process.env.PLATFORM_JWT_EXPIRES_IN || '12h';
  const maxAgeMs = parseDurationMs(expiresIn);
  const expiresAt = new Date(Date.now() + maxAgeMs);

  const payload: PlatformTokenPayload = {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    jti,
    scope: 'platform',
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });

  await prisma.platformSession.create({
    data: {
      platformAdminId: admin.id,
      token: jti,
      ipAddress: getClientIp(req),
      userAgent: (req.headers['user-agent'] as string) || 'unknown',
      isValid: true,
      expiresAt,
    },
  });

  await prisma.platformAdmin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  res.cookie(PLATFORM_COOKIE, token, cookieOptions(maxAgeMs));

  return {
    token,
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
  };
};

export const signPlatformChallenge = (adminId: string): string =>
  jwt.sign(
    { id: adminId, type: 'platform_2fa_challenge' } as PlatformChallengePayload,
    process.env.JWT_SECRET!,
    { expiresIn: '5m' }
  );

export const verifyPlatformChallenge = (token: string): PlatformChallengePayload => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as PlatformChallengePayload;
  if (decoded.type !== 'platform_2fa_challenge') {
    throw new jwt.JsonWebTokenError('Not a platform challenge token');
  }
  return decoded;
};

export const revokePlatformSession = async (jti: string): Promise<void> => {
  await prisma.platformSession.updateMany({
    where: { token: jti },
    data: { isValid: false },
  });
};

export const revokeAllPlatformSessions = async (adminId: string): Promise<void> => {
  await prisma.platformSession.updateMany({
    where: { platformAdminId: adminId, isValid: true },
    data: { isValid: false },
  });
};

export const clearPlatformCookie = (res: Response): void => {
  res.clearCookie(PLATFORM_COOKIE, { path: '/' });
};
