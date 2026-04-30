import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
];

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

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      throw new AppError('Invalid credentials', 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        organization: {
          status: 'ACTIVE',
        },
      },
      orderBy: { joinedAt: 'asc' },
      select: {
        role: true,
        organizationId: true,
      },
    });

    if (!membership) {
      throw new AppError('No active organization membership found', 403);
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: membership.role,
        organizationId: membership.organizationId,
      },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
    );

    logger.info(`User ${user.email} logged in`);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: membership.role,
        organizationId: membership.organizationId,
        avatar: user.avatar,
      },
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
      select: {
        role: true,
        organizationId: true,
      },
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

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      throw new AppError('Current password is incorrect', 400);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    logger.info(`User ${user.email} changed password`);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};
