import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import prisma from '../config/database';
import { PLATFORM_COOKIE } from '../services/platformSessionService';

declare global {
  namespace Express {
    interface Request {
      platformAdmin?: {
        id: string;
        email: string;
        role: string;
        jti: string;
      };
    }
  }
}

const extractToken = (req: Request): string | undefined => {
  const cookieToken = (req as Request & { cookies?: Record<string, string> })
    .cookies?.[PLATFORM_COOKIE];
  if (cookieToken) return cookieToken;
  return req.headers.authorization?.split(' ')[1];
};

/**
 * Autentica um operador de plataforma. Independente de tenant: valida o JWT
 * com scope 'platform' e a PlatformSession (revogável). Tokens de tenant NÃO
 * passam aqui (não têm scope 'platform' nem jti em platform_sessions).
 */
export const authenticatePlatform = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError('Platform access token required', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      email: string;
      role: string;
      jti?: string;
      scope?: string;
    };

    if (decoded.scope !== 'platform' || !decoded.jti) {
      throw new AppError('Invalid platform token', 401);
    }

    const session = await prisma.platformSession.findUnique({
      where: { token: decoded.jti },
      select: { id: true, isValid: true, expiresAt: true },
    });

    if (!session || !session.isValid || session.expiresAt < new Date()) {
      throw new AppError('Platform session expired or revoked', 401);
    }

    const admin = await prisma.platformAdmin.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!admin || !admin.isActive) {
      throw new AppError('Platform admin not found or inactive', 403);
    }

    req.platformAdmin = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      jti: decoded.jti,
    };

    prisma.platformSession
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid platform token', 401));
    }
    next(error);
  }
};

/**
 * Restringe por papel de plataforma. SUPERADMIN tem acesso a tudo.
 */
export const requirePlatformRole = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.platformAdmin?.role;
    if (!role) {
      return next(new AppError('Platform authentication required', 401));
    }
    if (role === 'SUPERADMIN' || roles.includes(role)) {
      return next();
    }
    return next(new AppError('Insufficient platform permissions', 403));
  };
};
