import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import prisma from '../config/database';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: string;
        organizationId?: string;
        membership?: {
          role: string;
          organizationId: string;
        };
      };
      rawBody?: string;
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new AppError('Access token required', 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      email: string;
      name: string;
      role: string;
      organizationId?: string;
    };

    let role = decoded.role;
    let organizationId = decoded.organizationId;

    if (!organizationId) {
      const membership = await prisma.organizationMember.findFirst({
        where: {
          userId: decoded.id,
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

      role = membership.role;
      organizationId = membership.organizationId;
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role,
      organizationId,
      membership: {
        role,
        organizationId,
      },
    };
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
