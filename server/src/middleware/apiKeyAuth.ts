/**
 * Middleware de autenticação por API Key
 * Suporta header: Authorization: Bearer sk_live_xxx
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export const apiKeyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer sk_live_')) {
    return res.status(401).json({
      error: 'API key inválida ou ausente. Use: Authorization: Bearer sk_live_...',
    });
  }

  const rawKey = authHeader.slice(7); // Remove "Bearer "
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        organization: {
          select: { id: true, status: true, plan: true },
        },
      },
    });

    if (!apiKey || !apiKey.isActive) {
      return res.status(401).json({ error: 'API key revogada ou não encontrada' });
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return res.status(401).json({ error: 'API key expirada' });
    }

    if (apiKey.organization.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Organização suspensa ou cancelada' });
    }

    // Atualizar lastUsedAt sem bloquear a requisição
    prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch((err) => logger.warn(`Failed to update lastUsedAt: ${err.message}`));

    // Injetar contexto mínimo no request (compatível com middleware authenticate)
    req.user = {
      id: `apikey:${apiKey.id}`,
      organizationId: apiKey.organizationId,
      role: 'API',
      apiKeyPermissions: JSON.parse(apiKey.permissions) as string[],
    } as any;

    next();
  } catch (err: any) {
    logger.error(`API key auth error: ${err.message}`);
    return res.status(500).json({ error: 'Erro interno de autenticação' });
  }
};

/**
 * Verifica se a API key tem uma permissão específica
 */
export const requireApiPermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const perms: string[] = (req.user as any)?.apiKeyPermissions ?? [];
    if (perms.includes(permission)) {
      return next();
    }
    return res.status(403).json({
      error: `Permissão '${permission}' não concedida para esta API key`,
    });
  };
};
