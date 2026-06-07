import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import {
  comparePassword,
  hashPassword,
  validatePasswordStrength,
} from '../utils/password';
import {
  issueSession,
  recordLoginAttempt,
  signChallengeToken,
  revokeAllSessions,
  revokeSession,
  clearSessionCookie,
} from '../services/sessionService';

export const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 1 }),
];

const findActiveMembership = (userId: string) =>
  prisma.organizationMember.findFirst({
    where: {
      userId,
      isActive: true,
      organization: { status: 'ACTIVE' },
    },
    orderBy: { joinedAt: 'asc' },
    select: { role: true, organizationId: true },
  });

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      // Mensagem genérica para não revelar existência da conta
      throw new AppError('Invalid credentials', 401);
    }

    const isValidPassword = await comparePassword(password, user.password);

    if (!isValidPassword) {
      await recordLoginAttempt(req, user.id, 'FAILED', 'invalid_password');
      throw new AppError('Invalid credentials', 401);
    }

    const membership = await findActiveMembership(user.id);

    if (!membership) {
      throw new AppError('No active organization membership found', 403);
    }

    // 🔐 2FA: se ativo, NÃO emite a sessão final. Devolve um desafio.
    if (user.twoFactorEnabled) {
      await recordLoginAttempt(req, user.id, '2FA_REQUIRED');
      const challengeToken = signChallengeToken(user.id);

      logger.info(`User ${user.email} passed password, awaiting 2FA`);

      return res.json({
        success: true,
        requires2FA: true,
        challengeToken,
      });
    }

    const session = await issueSession(req, res, user, membership);

    logger.info(`User ${user.email} logged in`);

    res.json({
      success: true,
      token: session.token,
      user: session.user,
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        twoFactorEnabled: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: req.user.id,
        organizationId: req.user.organizationId,
        isActive: true,
      },
      select: { role: true, organizationId: true },
    });

    if (!membership) {
      throw new AppError('Active organization membership not found', 403);
    }

    res.json({
      success: true,
      user: {
        ...user,
        role: membership.role,
        organizationId: membership.organizationId,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('currentPassword and newPassword are required', 400);
    }

    // Política de senha forte para a nova senha
    validatePasswordStrength(newPassword);

    if (currentPassword === newPassword) {
      throw new AppError('A nova senha deve ser diferente da atual.', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isValidPassword = await comparePassword(currentPassword, user.password);

    if (!isValidPassword) {
      throw new AppError('Current password is incorrect', 400);
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    // Revoga todas as outras sessões; mantém a sessão atual ativa.
    await revokeAllSessions(req.user.id, req.user.jti);

    logger.info(`User ${user.email} changed password`);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};

/** Logout: invalida a sessão atual e limpa o cookie. */
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.jti) {
      await revokeSession(req.user.jti);
    }
    clearSessionCookie(res);
    res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    next(error);
  }
};

/** Logout global: invalida todas as sessões do usuário. */
export const logoutAll = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }
    await revokeAllSessions(req.user.id);
    clearSessionCookie(res);
    res.json({ success: true, message: 'All sessions revoked' });
  } catch (error) {
    next(error);
  }
};

/** Lista as sessões ativas do usuário (gestão de dispositivos). */
export const listSessions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const sessions = await prisma.deviceSession.findMany({
      where: { userId: req.user.id, isValid: true, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        ipAddress: true,
        location: true,
        lastUsedAt: true,
        createdAt: true,
        token: true,
      },
    });

    res.json({
      success: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        deviceName: s.deviceName,
        deviceType: s.deviceType,
        ipAddress: s.ipAddress,
        location: s.location,
        lastUsedAt: s.lastUsedAt,
        createdAt: s.createdAt,
        current: s.token === req.user?.jti,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/** Revoga uma sessão específica do próprio usuário. */
export const revokeSessionById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { id } = req.params;

    const session = await prisma.deviceSession.findFirst({
      where: { id, userId: req.user.id },
      select: { id: true },
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    await prisma.deviceSession.update({
      where: { id: session.id },
      data: { isValid: false },
    });

    res.json({ success: true, message: 'Session revoked' });
  } catch (error) {
    next(error);
  }
};
