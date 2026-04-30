import { Request, Response, NextFunction } from 'express';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { cache } from '../config/redis';

/**
 * Gerar secret para 2FA
 */
export const generate2FASecret = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    // Gerar secret
    const secret = speakeasy.generateSecret({
      name: `Afeto SAC (${req.user?.email})`,
      length: 32,
    });

    // Salvar temporary secret
    await cache.set(
      `2fa:setup:${userId}`,
      secret.base32,
      600 // 10 minutos
    );

    // Gerar QR Code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    res.json({
      success: true,
      secret: secret.base32,
      qrCode: qrCodeUrl,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verificar e ativar 2FA
 */
export const verifyAndEnable2FA = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { token } = req.body;

    // Recuperar secret temporário
    const secret = await cache.get(`2fa:setup:${userId}`);
    if (!secret) {
      throw new AppError('Setup expired, please try again', 400);
    }

    // Verificar token
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      throw new AppError('Invalid verification code', 400);
    }

    // Gerar backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );

    // Salvar no banco
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: true,
        twoFactorBackupCodes: JSON.stringify(backupCodes),
      },
    });

    // Limpar cache
    await cache.del(`2fa:setup:${userId}`);

    logger.info(`2FA enabled for user ${userId}`);

    res.json({
      success: true,
      message: '2FA enabled successfully',
      backupCodes, // Mostrar apenas uma vez!
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Desativar 2FA
 */
export const disable2FA = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { password } = req.body;

    // Verificar senha
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const bcrypt = require('bcryptjs');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new AppError('Invalid password', 400);
    }

    // Desativar 2FA
    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: null,
        twoFactorEnabled: false,
        twoFactorBackupCodes: null,
      },
    });

    logger.info(`2FA disabled for user ${userId}`);

    res.json({
      success: true,
      message: '2FA disabled successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verificar token 2FA no login
 */
export const verify2FALogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, token, backupCode } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled) {
      throw new AppError('2FA not enabled for this user', 400);
    }

    // Verificar se é backup code
    if (backupCode) {
      const backupCodes = JSON.parse(user.twoFactorBackupCodes || '[]');
      const index = backupCodes.indexOf(backupCode.toUpperCase());

      if (index === -1) {
        throw new AppError('Invalid backup code', 400);
      }

      // Remover backup code usado
      backupCodes.splice(index, 1);
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorBackupCodes: JSON.stringify(backupCodes) },
      });

      logger.warn(`Backup code used for user ${userId}`);
    } else {
      // Verificar TOTP
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret!,
        encoding: 'base32',
        token,
        window: 2,
      });

      if (!verified) {
        throw new AppError('Invalid verification code', 400);
      }
    }

    // Gerar JWT completo
    const jwt = require('jsonwebtoken');
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Gerar novos backup codes
 */
export const regenerateBackupCodes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { token } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled) {
      throw new AppError('2FA not enabled', 400);
    }

    // Verificar token atual
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret!,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!verified) {
      throw new AppError('Invalid verification code', 400);
    }

    // Gerar novos backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorBackupCodes: JSON.stringify(backupCodes) },
    });

    logger.info(`Backup codes regenerated for user ${userId}`);

    res.json({
      success: true,
      backupCodes,
    });
  } catch (error) {
    next(error);
  }
};
