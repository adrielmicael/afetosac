import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import prisma from '../config/database';
import { ACCESS_COOKIE } from '../services/sessionService';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: string;
        organizationId?: string;
        jti?: string;
        membership?: {
          role: string;
          organizationId: string;
        };
      };
      rawBody?: string;
    }
  }
}

const extractToken = (req: Request): string | undefined => {
  // 1. Cookie httpOnly (mecanismo preferencial)
  const cookieToken = (req as Request & { cookies?: Record<string, string> })
    .cookies?.[ACCESS_COOKIE];
  if (cookieToken) return cookieToken;

  // 2. Fallback Bearer (API pública / Socket.io)
  return req.headers.authorization?.split(' ')[1];
};

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new AppError('Access token required', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      email: string;
      name: string;
      role?: string;
      organizationId?: string;
      jti?: string;
      type?: string;
    };

    // Tokens de desafio 2FA não autenticam rotas protegidas
    if (decoded.type === '2fa_challenge') {
      throw new AppError('Invalid token', 401);
    }

    // 🔒 Sessão revogável: o jti precisa corresponder a uma DeviceSession válida
    if (!decoded.jti) {
      throw new AppError('Invalid session', 401);
    }

    const session = await prisma.deviceSession.findUnique({
      where: { token: decoded.jti },
      select: { id: true, isValid: true, expiresAt: true },
    });

    if (!session || !session.isValid || session.expiresAt < new Date()) {
      throw new AppError('Session expired or revoked', 401);
    }

    let role = decoded.role;
    let organizationId = decoded.organizationId;

    if (!organizationId) {
      const membership = await prisma.organizationMember.findFirst({
        where: {
          userId: decoded.id,
          isActive: true,
          organization: { status: 'ACTIVE' },
        },
        orderBy: { joinedAt: 'asc' },
        select: { role: true, organizationId: true },
      });

      if (!membership) {
        throw new AppError('No active organization membership found', 403);
      }

      role = membership.role;
      organizationId = membership.organizationId;
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: role!,
      organizationId,
      jti: decoded.jti,
      membership: {
        role: role!,
        organizationId: organizationId!,
      },
    };

    // Atualiza lastUsedAt de forma best-effort (não bloqueia a requisição)
    prisma.deviceSession
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid token', 401));
    }
    next(error);
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
};
