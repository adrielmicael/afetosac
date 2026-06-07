import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { cache } from '../config/redis';
import { comparePassword } from '../utils/password';
import { recordPlatformAudit } from '../services/platformAudit';
import {
  issuePlatformSession,
  signPlatformChallenge,
  verifyPlatformChallenge,
  revokePlatformSession,
  revokeAllPlatformSessions,
  clearPlatformCookie,
} from '../services/platformSessionService';

export const validatePlatformLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 1 }),
];

export const platformLogin = async (
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
    const admin = await prisma.platformAdmin.findUnique({ where: { email } });

    if (!admin || !admin.isActive) {
      throw new AppError('Invalid credentials', 401);
    }

    const validPassword = await comparePassword(password, admin.password);
    if (!validPassword) {
      await recordPlatformAudit(req, {
        action: 'LOGIN_FAILED',
        actorId: admin.id,
        actorEmail: admin.email,
        targetType: 'PLATFORM',
      });
      throw new AppError('Invalid credentials', 401);
    }

    // 2FA obrigatório para operadores de plataforma: se ainda não habilitado,
    // emite a sessão mas sinaliza que o setup é requerido.
    if (admin.twoFactorEnabled) {
      const challengeToken = signPlatformChallenge(admin.id);
      await recordPlatformAudit(req, {
        action: 'LOGIN_2FA_REQUIRED',
        actorId: admin.id,
        actorEmail: admin.email,
        targetType: 'PLATFORM',
      });
      return res.json({ success: true, requires2FA: true, challengeToken });
    }

    const session = await issuePlatformSession(req, res, admin);
    await recordPlatformAudit(req, { action: 'LOGIN', targetType: 'PLATFORM', actorId: admin.id, actorEmail: admin.email });

    res.json({
      success: true,
      token: session.token,
      admin: session.admin,
      mustEnable2FA: true, // política: habilite 2FA imediatamente
    });
  } catch (error) {
    next(error);
  }
};

export const platformVerify2FA = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { challengeToken, token, backupCode } = req.body;
    if (!challengeToken) {
      throw new AppError('Challenge token required', 400);
    }

    let adminId: string;
    try {
      ({ id: adminId } = verifyPlatformChallenge(challengeToken));
    } catch {
      throw new AppError('Challenge expired or invalid, please login again', 401);
    }

    const admin = await prisma.platformAdmin.findUnique({ where: { id: adminId } });
    if (!admin || !admin.isActive || !admin.twoFactorEnabled) {
      throw new AppError('2FA not enabled for this account', 400);
    }

    if (backupCode) {
      const codes = JSON.parse(admin.twoFactorBackupCodes || '[]');
      const idx = codes.indexOf(String(backupCode).toUpperCase());
      if (idx === -1) throw new AppError('Invalid backup code', 400);
      codes.splice(idx, 1);
      await prisma.platformAdmin.update({
        where: { id: adminId },
        data: { twoFactorBackupCodes: JSON.stringify(codes) },
      });
    } else {
      const verified = speakeasy.totp.verify({
        secret: admin.twoFactorSecret!,
        encoding: 'base32',
        token,
        window: 2,
      });
      if (!verified) throw new AppError('Invalid verification code', 400);
    }

    const session = await issuePlatformSession(req, res, admin);
    await recordPlatformAudit(req, { action: 'LOGIN', targetType: 'PLATFORM', actorId: admin.id, actorEmail: admin.email });

    res.json({ success: true, token: session.token, admin: session.admin });
  } catch (error) {
    next(error);
  }
};

export const platformMe = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.platformAdmin) throw new AppError('Not authenticated', 401);

    const admin = await prisma.platformAdmin.findUnique({
      where: { id: req.platformAdmin.id },
      select: { id: true, email: true, name: true, role: true, twoFactorEnabled: true, lastLoginAt: true },
    });
    if (!admin) throw new AppError('Platform admin not found', 404);

    res.json({ success: true, admin });
  } catch (error) {
    next(error);
  }
};

export const platformLogout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.platformAdmin?.jti) {
      await revokePlatformSession(req.platformAdmin.jti);
    }
    clearPlatformCookie(res);
    await recordPlatformAudit(req, { action: 'LOGOUT', targetType: 'PLATFORM' });
    res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    next(error);
  }
};

export const platformLogoutAll = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.platformAdmin) throw new AppError('Not authenticated', 401);
    await revokeAllPlatformSessions(req.platformAdmin.id);
    clearPlatformCookie(res);
    res.json({ success: true, message: 'All platform sessions revoked' });
  } catch (error) {
    next(error);
  }
};

// ===== 2FA setup (para cumprir a política de 2FA obrigatório) =====

export const platformSetup2FA = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.platformAdmin) throw new AppError('Not authenticated', 401);

    const secret = speakeasy.generateSecret({
      name: `Afeto SAC Platform (${req.platformAdmin.email})`,
      length: 32,
    });

    await cache.set(`platform:2fa:setup:${req.platformAdmin.id}`, secret.base32, 600);
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    res.json({ success: true, secret: secret.base32, qrCode });
  } catch (error) {
    next(error);
  }
};

export const platformEnable2FA = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.platformAdmin) throw new AppError('Not authenticated', 401);
    const { token } = req.body;

    const secret = await cache.get(`platform:2fa:setup:${req.platformAdmin.id}`);
    if (!secret) throw new AppError('Setup expired, please try again', 400);

    const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 2 });
    if (!verified) throw new AppError('Invalid verification code', 400);

    const backupCodes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );

    await prisma.platformAdmin.update({
      where: { id: req.platformAdmin.id },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: true,
        twoFactorBackupCodes: JSON.stringify(backupCodes),
      },
    });
    await cache.del(`platform:2fa:setup:${req.platformAdmin.id}`);
    await recordPlatformAudit(req, { action: '2FA_ENABLED', targetType: 'PLATFORM' });

    logger.info(`Platform 2FA enabled for ${req.platformAdmin.email}`);
    res.json({ success: true, backupCodes });
  } catch (error) {
    next(error);
  }
};
