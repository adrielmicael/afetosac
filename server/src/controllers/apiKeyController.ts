import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const AVAILABLE_PERMISSIONS = [
  'read_chats',
  'write_chats',
  'read_messages',
  'write_messages',
  'read_patients',
  'write_patients',
  'read_dashboard',
] as const;

function generateApiKey(): { fullKey: string; prefix: string; hash: string } {
  const raw = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
  const prefix = raw.substring(0, 20);
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { fullKey: raw, prefix, hash };
}

export const listApiKeys = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError('Organization context required', 400);

    const keys = await prisma.apiKey.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const parsed = keys.map((k) => ({
      ...k,
      permissions: JSON.parse(k.permissions) as string[],
    }));

    res.json({ data: parsed });
  } catch (error) {
    next(error);
  }
};

export const createApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) throw new AppError('Organization context required', 400);

    const { name, permissions, expiresAt } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      throw new AppError('Nome deve ter pelo menos 3 caracteres', 400);
    }

    const perms: string[] = Array.isArray(permissions) ? permissions : [];
    const invalidPerms = perms.filter((p) => !AVAILABLE_PERMISSIONS.includes(p as any));
    if (invalidPerms.length > 0) {
      throw new AppError(`Permissões inválidas: ${invalidPerms.join(', ')}`, 400);
    }

    const existingCount = await prisma.apiKey.count({
      where: { organizationId: orgId, isActive: true },
    });
    if (existingCount >= 10) {
      throw new AppError('Limite de 10 chaves ativas atingido', 400);
    }

    const { fullKey, prefix, hash } = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        keyHash: hash,
        keyPrefix: prefix,
        permissions: JSON.stringify(perms),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: userId,
      },
    });

    logger.info(`API key created: ${apiKey.id} for org ${orgId}`);

    res.status(201).json({
      data: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        permissions: perms,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
        // Retorna a chave completa SOMENTE na criação — não é armazenada
        fullKey,
        warning: 'Guarde esta chave agora. Ela não será exibida novamente.',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const revokeApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError('Organization context required', 400);

    const { id } = req.params;

    const key = await prisma.apiKey.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!key) throw new AppError('Chave não encontrada', 404);

    await prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info(`API key revoked: ${id} for org ${orgId}`);
    res.json({ message: 'Chave revogada com sucesso' });
  } catch (error) {
    next(error);
  }
};
