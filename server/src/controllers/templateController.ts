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

export const getTemplates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);

    const templates = await prisma.template.findMany({
      where: { isActive: true, organizationId },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      templates,
    });
  } catch (error) {
    next(error);
  }
};

export const createTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, description, content, variables, category } = req.body;
    const organizationId = getOrganizationId(req);

    const template = await prisma.template.create({
      data: {
        organizationId,
        name,
        description,
        content,
        variables,
        category,
      },
    });

    res.status(201).json({
      success: true,
      template,
    });
  } catch (error) {
    next(error);
  }
};

export const updateTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name, description, content, variables, category, isActive } = req.body;
    const organizationId = getOrganizationId(req);

    const existing = await prisma.template.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Template not found', 404);
    }

    const template = await prisma.template.update({
      where: { id: existing.id },
      data: {
        name,
        description,
        content,
        variables,
        category,
        isActive,
      },
    });

    res.json({
      success: true,
      template,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const existing = await prisma.template.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Template not found', 404);
    }

    await prisma.template.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
