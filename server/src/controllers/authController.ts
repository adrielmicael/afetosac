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
import { issuePlatformSession, signPlatformChallenge } from '../services/platformSessionService';
import { recordPlatformAudit } from '../services/platformAudit';

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

    // 🛡️ Login unificado: se o e-mail for de um operador de PLATAFORMA, resolve aqui.
    // (identidade separada dos usuários de clínica; tokens/escopos continuam distintos)
    const platformAdmin = await prisma.platformAdmin.findUnique({ where: { email } });
    if (platformAdmin && platformAdmin.isActive) {
      const validAdmin = await comparePassword(password, platformAdmin.password);
      if (!validAdmin) {
        await recordPlatformAudit(req, {
          action: 'LOGIN_FAILED',
          actorId: platformAdmin.id,
          actorEmail: platformAdmin.email,
          targetType: 'PLATFORM',
        });
        throw new AppError('Invalid credentials', 401);
      }

      if (platformAdmin.twoFactorEnabled) {
        await recordPlatformAudit(req, {
          action: 'LOGIN_2FA_REQUIRED',
          actorId: platformAdmin.id,
          actorEmail: platformAdmin.email,
          targetType: 'PLATFORM',
        });
        return res.json({
          success: true,
          requires2FA: true,
          challengeToken: signPlatformChallenge(platformAdmin.id),
          scope: 'platform',
        });
      }

      const session = await issuePlatformSession(req, res, platformAdmin);
      await recordPlatformAudit(req, {
        action: 'LOGIN',
        targetType: 'PLATFORM',
        actorId: platformAdmin.id,
        actorEmail: platformAdmin.email,
      });
      logger.info(`Platform admin ${platformAdmin.email} logged in`);
      return res.json({
        success: true,
        token: session.token,
        admin: session.admin,
        scope: 'platform',
        mustEnable2FA: true,
      });
    }

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
        scope: 'tenant',
      });
    }

    const session = await issueSession(req, res, user, membership);

    logger.info(`User ${user.email} logged in`);

    res.json({
      success: true,
      scope: 'tenant',
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

export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { name, avatar } = req.body;
    const data: { name?: string; avatar?: string | null } = {};
    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (avatar !== undefined) data.avatar = avatar || null;

    if (Object.keys(data).length === 0) {
      throw new AppError('Nada para atualizar', 400);
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: { id: true, email: true, name: true, avatar: true },
    });

    res.json({ success: true, user });
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
