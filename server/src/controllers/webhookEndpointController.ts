import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const VALID_EVENTS = [
  'chat.created',
  'chat.closed',
  'chat.assigned',
  'message.received',
  'message.sent',
  'patient.created',
  '*',
] as const;

function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}

export const listWebhookEndpoints = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError('Organization context required', 400);

    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        url: true,
        description: true,
        events: true,
        isActive: true,
        failureCount: true,
        lastDeliveryAt: true,
        lastStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const parsed = endpoints.map((ep) => ({
      ...ep,
      events: JSON.parse(ep.events) as string[],
    }));

    res.json({ data: parsed });
  } catch (error) {
    next(error);
  }
};

export const createWebhookEndpoint = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) throw new AppError('Organization context required', 400);

    const { url, events, description } = req.body;

    if (!url || typeof url !== 'string') {
      throw new AppError('URL é obrigatória', 400);
    }

    try {
      new URL(url);
    } catch {
      throw new AppError('URL inválida', 400);
    }

    if (!url.startsWith('https://')) {
      throw new AppError('Apenas URLs HTTPS são permitidas', 400);
    }

    const eventsArr: string[] = Array.isArray(events) ? events : [];
    const invalidEvents = eventsArr.filter((e) => !VALID_EVENTS.includes(e as any));
    if (invalidEvents.length > 0) {
      throw new AppError(`Eventos inválidos: ${invalidEvents.join(', ')}`, 400);
    }

    const existingCount = await prisma.webhookEndpoint.count({
      where: { organizationId: orgId, isActive: true },
    });
    if (existingCount >= 5) {
      throw new AppError('Limite de 5 endpoints ativos atingido', 400);
    }

    const secret = generateWebhookSecret();

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        organizationId: orgId,
        url,
        secret,
        events: JSON.stringify(eventsArr),
        description: description || null,
        createdBy: userId,
      },
    });

    logger.info(`Webhook endpoint created: ${endpoint.id} for org ${orgId}`);

    res.status(201).json({
      data: {
        id: endpoint.id,
        url: endpoint.url,
        description: endpoint.description,
        events: eventsArr,
        isActive: endpoint.isActive,
        createdAt: endpoint.createdAt,
        // Retorna o segredo SOMENTE na criação
        secret,
        warning: 'Guarde o segredo agora. Ele não será exibido novamente.',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateWebhookEndpoint = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError('Organization context required', 400);

    const { id } = req.params;
    const { events, description, isActive } = req.body;

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!endpoint) throw new AppError('Endpoint não encontrado', 404);

    const updateData: Record<string, unknown> = {};
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (Array.isArray(events)) {
      const invalid = events.filter((e) => !VALID_EVENTS.includes(e as any));
      if (invalid.length > 0) throw new AppError(`Eventos inválidos: ${invalid.join(', ')}`, 400);
      updateData.events = JSON.stringify(events);
      // Resetar contagem de falhas ao reativar
      if (isActive === true) updateData.failureCount = 0;
    }

    const updated = await prisma.webhookEndpoint.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        url: true,
        description: true,
        events: true,
        isActive: true,
        failureCount: true,
        lastDeliveryAt: true,
        lastStatus: true,
      },
    });

    res.json({
      data: { ...updated, events: JSON.parse(updated.events) },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteWebhookEndpoint = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError('Organization context required', 400);

    const { id } = req.params;

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!endpoint) throw new AppError('Endpoint não encontrado', 404);

    await prisma.webhookEndpoint.delete({ where: { id } });

    logger.info(`Webhook endpoint deleted: ${id} for org ${orgId}`);
    res.json({ message: 'Endpoint removido com sucesso' });
  } catch (error) {
    next(error);
  }
};

export const testWebhookEndpoint = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) throw new AppError('Organization context required', 400);

    const { id } = req.params;

    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!endpoint) throw new AppError('Endpoint não encontrado', 404);

    const body = JSON.stringify({
      event: 'test',
      organizationId: orgId,
      timestamp: new Date().toISOString(),
      data: { message: 'Teste de conectividade Afeto SAC' },
    });

    const signature = `sha256=${crypto
      .createHmac('sha256', endpoint.secret)
      .update(body)
      .digest('hex')}`;

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Afeto-Signature': signature,
          'X-Afeto-Event': 'test',
          'User-Agent': 'AfetoSAC-Webhooks/1.0',
        },
        body,
        signal: AbortSignal.timeout(8000),
      });

      res.json({
        success: response.ok,
        status: response.status,
        message: response.ok ? 'Entrega bem-sucedida' : `Falhou com status ${response.status}`,
      });
    } catch (err: any) {
      res.json({ success: false, status: 'timeout', message: err.message });
    }
  } catch (error) {
    next(error);
  }
};
