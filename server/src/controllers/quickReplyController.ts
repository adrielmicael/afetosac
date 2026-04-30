import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';

const getOrganizationId = (req: Request): string => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AppError('Organization context required', 400);
  }
  return organizationId;
};

export const getQuickReplies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);

    const replies = await prisma.quickReply.findMany({
      where: { isActive: true, organizationId },
      orderBy: { category: 'asc' },
    });

    res.json({
      success: true,
      replies,
    });
  } catch (error) {
    next(error);
  }
};

export const createQuickReply = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { title, content, category } = req.body;
    const organizationId = getOrganizationId(req);

    const reply = await prisma.quickReply.create({
      data: {
        organizationId,
        title,
        content,
        category,
      },
    });

    res.status(201).json({
      success: true,
      reply,
    });
  } catch (error) {
    next(error);
  }
};

export const updateQuickReply = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { title, content, category, isActive } = req.body;
    const organizationId = getOrganizationId(req);

    const existing = await prisma.quickReply.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Quick reply not found', 404);
    }

    const reply = await prisma.quickReply.update({
      where: { id: existing.id },
      data: {
        title,
        content,
        category,
        isActive,
      },
    });

    res.json({
      success: true,
      reply,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteQuickReply = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const existing = await prisma.quickReply.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Quick reply not found', 404);
    }

    await prisma.quickReply.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Quick reply deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
