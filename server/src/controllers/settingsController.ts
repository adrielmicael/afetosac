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

export const getSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);
    const settings = await prisma.setting.findMany({
      where: { organizationId },
    });

    const settingsMap = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    res.json({
      success: true,
      settings: settingsMap,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);
    const updates = req.body;

    for (const [key, value] of Object.entries(updates)) {
      await prisma.setting.upsert({
        where: {
          organizationId_key: {
            organizationId,
            key,
          },
        },
        update: { value: value as string },
        create: { organizationId, key, value: value as string },
      });
    }

    res.json({
      success: true,
      message: 'Settings updated successfully',
    });
  } catch (error) {
    next(error);
  }
};
