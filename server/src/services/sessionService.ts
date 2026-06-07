import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export const ACCESS_COOKIE = 'access_token';

type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
};

type Membership = {
  role: string;
  organizationId: string;
};

export type AccessTokenPayload = {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  jti: string;
};

export type ChallengePayload = {
  id: string;
  type: '2fa_challenge';
};

/**
 * Converte strings como "7d", "12h", "30m", "3600s" em milissegundos.
 * Fallback: 7 dias.
 */
export const parseDurationMs = (value: string | undefined): number => {
  if (!value) return 7 * 24 * 60 * 60 * 1000;
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber * 1000 : 7 * 24 * 60 * 60 * 1000;
  }
  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return amount * factor;
};

const cookieOptions = (maxAgeMs: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: maxAgeMs,
});

const detectDeviceType = (userAgent: string): string => {
  const ua = userAgent.toLowerCase();
  if (/mobile|iphone|android/.test(ua)) return 'mobile';
  if (/ipad|tablet/.test(ua)) return 'tablet';
  return 'desktop';
};

const friendlyDeviceName = (userAgent: string): string => {
  const browser = /edg/i.test(userAgent)
    ? 'Edge'
    : /chrome/i.test(userAgent)
    ? 'Chrome'
    : /firefox/i.test(userAgent)
    ? 'Firefox'
    : /safari/i.test(userAgent)
    ? 'Safari'
    : 'Navegador';
  const os = /windows/i.test(userAgent)
    ? 'Windows'
    : /mac os/i.test(userAgent)
    ? 'macOS'
    : /android/i.test(userAgent)
    ? 'Android'
    : /iphone|ipad|ios/i.test(userAgent)
    ? 'iOS'
    : /linux/i.test(userAgent)
    ? 'Linux'
    : '';
  return os ? `${browser} em ${os}` : browser;
};

const getClientIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
  req.ip ||
  req.socket?.remoteAddress ||
  'unknown';

/**
 * Emite uma sessão completa: gera JWT com jti, registra DeviceSession +
 * LoginHistory, atualiza lastLoginAt e seta o cookie httpOnly.
 * Retorna o token (fallback Bearer) e o payload de usuário para o cliente.
 */
export const issueSession = async (
  req: Request,
  res: Response,
  user: SessionUser,
  membership: Membership
): Promise<{ token: string; user: Record<string, unknown> }> => {
  const jti = crypto.randomUUID();
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const maxAgeMs = parseDurationMs(expiresIn);
  const expiresAt = new Date(Date.now() + maxAgeMs);

  const payload: AccessTokenPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: membership.role,
    organizationId: membership.organizationId,
    jti,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });

  const userAgent = (req.headers['user-agent'] as string) || 'unknown';
  const ipAddress = getClientIp(req);

  await prisma.deviceSession.create({
    data: {
      userId: user.id,
      token: jti,
      deviceName: friendlyDeviceName(userAgent),
      deviceType: detectDeviceType(userAgent),
      ipAddress,
      userAgent,
      isValid: true,
      expiresAt,
    },
  });

  await prisma.loginHistory.create({
    data: {
      userId: user.id,
      organizationId: membership.organizationId,
      status: 'SUCCESS',
      ipAddress,
      userAgent,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  res.cookie(ACCESS_COOKIE, token, cookieOptions(maxAgeMs));

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar ?? null,
      role: membership.role,
      organizationId: membership.organizationId,
    },
  };
};

/**
 * Registra uma tentativa de login que não resultou em sessão
 * (senha incorreta ou 2FA pendente).
 */
export const recordLoginAttempt = async (
  req: Request,
  userId: string,
  status: 'FAILED' | '2FA_REQUIRED',
  failureReason?: string
): Promise<void> => {
  try {
    await prisma.loginHistory.create({
      data: {
        userId,
        status,
        ipAddress: getClientIp(req),
        userAgent: (req.headers['user-agent'] as string) || 'unknown',
        failureReason: failureReason || null,
      },
    });
  } catch (error) {
    logger.warn('Failed to record login attempt', error);
  }
};

/** Cria um token de desafio de curta duração para a etapa de 2FA. */
export const signChallengeToken = (userId: string): string =>
  jwt.sign(
    { id: userId, type: '2fa_challenge' } as ChallengePayload,
    process.env.JWT_SECRET!,
    { expiresIn: '5m' }
  );

export const verifyChallengeToken = (token: string): ChallengePayload => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as ChallengePayload;
  if (decoded.type !== '2fa_challenge') {
    throw new jwt.JsonWebTokenError('Not a challenge token');
  }
  return decoded;
};

/** Invalida a sessão atual (logout). */
export const revokeSession = async (jti: string): Promise<void> => {
  await prisma.deviceSession.updateMany({
    where: { token: jti },
    data: { isValid: false },
  });
};

/** Invalida todas as sessões de um usuário, opcionalmente preservando uma. */
export const revokeAllSessions = async (
  userId: string,
  exceptJti?: string
): Promise<void> => {
  await prisma.deviceSession.updateMany({
    where: {
      userId,
      isValid: true,
      ...(exceptJti ? { token: { not: exceptJti } } : {}),
    },
    data: { isValid: false },
  });
};

export const clearSessionCookie = (res: Response): void => {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
};

/**
 * Emite um token de TENANT para impersonação por um operador de plataforma.
 * Cria uma DeviceSession revogável e marcada, com expiração curta. NÃO seta
 * cookie — o token é retornado para uso explícito e auditável pelo painel.
 */
export const issueImpersonationToken = async (
  req: Request,
  params: {
    user: SessionUser & { id: string };
    membership: Membership;
    impersonatedBy: string;
    impersonatorEmail: string;
  }
): Promise<{ token: string; expiresAt: Date }> => {
  const { user, membership, impersonatedBy, impersonatorEmail } = params;
  const jti = crypto.randomUUID();
  const maxAgeMs = parseDurationMs(process.env.IMPERSONATION_EXPIRES_IN || '30m');
  const expiresAt = new Date(Date.now() + maxAgeMs);

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: membership.role,
      organizationId: membership.organizationId,
      jti,
      impersonatedBy, // rastreabilidade no próprio token
    },
    process.env.JWT_SECRET!,
    {
      expiresIn: (process.env.IMPERSONATION_EXPIRES_IN || '30m') as jwt.SignOptions['expiresIn'],
    }
  );

  await prisma.deviceSession.create({
    data: {
      userId: user.id,
      token: jti,
      deviceName: `IMPERSONATION by ${impersonatorEmail}`,
      deviceType: 'impersonation',
      ipAddress: getClientIp(req),
      userAgent: (req.headers['user-agent'] as string) || 'platform-impersonation',
      isValid: true,
      expiresAt,
    },
  });

  return { token, expiresAt };
};
