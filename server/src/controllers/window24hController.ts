import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { getWhatsAppClient, recordWhatsAppHealth } from '../services/whatsappService';
import { broadcastToChat } from '../services/realtimeService';

const extractWhatsAppMessageId = (response: any): string | null => {
  if (!response || typeof response !== 'object') return null;
  const first = Array.isArray(response.messages) ? response.messages[0] : null;
  const id = first?.id;
  return typeof id === 'string' ? id : null;
};

const getOrganizationId = (req: Request): string => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AppError('Organization context required', 400);
  }
  return organizationId;
};

/**
 * Verificar status da janela de 24h do WhatsApp
 * A janela abre quando o cliente envia uma mensagem
 * e fecha 24 horas após a última mensagem do cliente
 */
export const checkWindowStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chatId } = req.params;
    const organizationId = getOrganizationId(req);

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, organizationId },
      select: {
        id: true,
        is24hOpen: true,
        windowExpires: true,
        lastMessageAt: true,
        phone: true,
      },
    });

    if (!chat) {
      throw new AppError('Chat not found', 404);
    }

    // Calcular status atual
    const now = new Date();
    const windowExpired = chat.windowExpires ? now > chat.windowExpires : true;
    const isOpen = chat.is24hOpen && !windowExpired;

    // Tempo restante
    let timeRemaining = null;
    if (chat.windowExpires && !windowExpired) {
      const diff = chat.windowExpires.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      timeRemaining = { hours, minutes };
    }

    res.json({
      success: true,
      window: {
        isOpen,
        is24hOpen: chat.is24hOpen,
        windowExpires: chat.windowExpires?.toISOString(),
        lastMessageAt: chat.lastMessageAt?.toISOString(),
        timeRemaining,
        canSendMessage: isOpen,
        canSendTemplate: true, // Templates sempre podem ser enviados
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Forçar reabertura da janela enviando um template HSM
 */
export const reopenWindowWithTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chatId } = req.params;
    const { templateName, variables = [] } = req.body;
    const organizationId = getOrganizationId(req);

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, organizationId },
      include: {
        patient: true,
      },
    });

    if (!chat) {
      throw new AppError('Chat not found', 404);
    }

    if (!templateName) {
      throw new AppError('Template name is required', 400);
    }

    const template = await prisma.template.findFirst({
      where: { organizationId, name: templateName, isActive: true },
      select: { id: true, name: true },
    });

    if (!template) {
      throw new AppError('Template not found or inactive', 404);
    }

    // Enviar template via WhatsApp
    let whatsappMessageId: string | null = null;
    try {
      const wa = await getWhatsAppClient(organizationId);
      const response = await wa.sendTemplate(chat.phone, template.name, variables);
      whatsappMessageId = extractWhatsAppMessageId(response);
      await recordWhatsAppHealth(organizationId, 'CONNECTED');
    } catch (error) {
      await recordWhatsAppHealth(
        organizationId,
        'ERROR',
        (error as { message?: string })?.message
      );
      const err = error as { message?: string };
      await prisma.activity.create({
        data: {
          organizationId,
          userId: req.user?.id || 'system',
          type: 'DEAD_LETTER',
          description: `Falha permanente ao enviar template de reabertura para chat ${chatId}`,
          metadata: JSON.stringify({
            queue: 'template',
            chatId,
            templateName: template.name,
            variables,
            phone: chat.phone,
            error: err?.message || 'unknown_error',
            correlationId: req.correlationId,
            failedAt: new Date().toISOString(),
          }),
        },
      });

      throw error;
    }

    // Criar mensagem de template no banco
    const message = await prisma.message.create({
      data: {
        chatId,
        sender: 'BOT',
        senderId: req.user?.id,
        type: 'TEMPLATE',
        content: `Template: ${template.name}`,
        templateId: template.id,
        ...(whatsappMessageId ? { whatsappMessageId } : {}),
        status: 'DELIVERED',
      },
    });

    // A janela será reaberta automaticamente quando o cliente responder
    // Mas já atualizamos o status para indicar que tentamos reabrir
    logger.info(`Template sent to reopen window: ${template.name} to ${chat.phone}`);

    // Notificar via realtime (Supabase)
    await broadcastToChat(chatId, 'message:new', message);
    await broadcastToChat(chatId, 'window:reopening', { chatId, templateName: template.name });

    res.json({
      success: true,
      message: 'Template sent successfully. Window will reopen when customer replies.',
      data: {
        templateName: template.name,
        chatId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar templates HSM disponíveis (para reabrir janela)
 */
export const getAvailableTemplates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);
    const templates = await prisma.template.findMany({
      where: {
        organizationId,
        isActive: true,
        category: { in: ['UTILITY', 'MARKETING'] },
      },
      orderBy: { name: 'asc' },
    });

    // Adicionar preview das variáveis
    const templatesWithPreview = templates.map((t) => ({
      ...t,
      preview: t.variables
        ? JSON.parse(t.variables).reduce((acc: string, varName: string, i: number) => {
            return acc.replace(`{{${i + 1}}}`, `[${varName}]`);
          }, t.content)
        : t.content,
    }));

    res.json({
      success: true,
      templates: templatesWithPreview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obter estatísticas da janela 24h (para dashboard)
 */
export const getWindowStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const now = new Date();
    const organizationId = getOrganizationId(req);

    const [
      totalChats,
      openWindows,
      closedWindows,
      expiringSoon, // Fecha em menos de 4 horas
    ] = await Promise.all([
      prisma.chat.count({
        where: { channel: 'WHATSAPP', organizationId },
      }),
      prisma.chat.count({
        where: {
          organizationId,
          channel: 'WHATSAPP',
          is24hOpen: true,
          OR: [
            { windowExpires: { gt: now } },
            { windowExpires: null },
          ],
        },
      }),
      prisma.chat.count({
        where: {
          organizationId,
          channel: 'WHATSAPP',
          OR: [
            { is24hOpen: false },
            { windowExpires: { lte: now } },
          ],
        },
      }),
      prisma.chat.count({
        where: {
          organizationId,
          channel: 'WHATSAPP',
          is24hOpen: true,
          windowExpires: {
            gt: now,
            lte: new Date(now.getTime() + 4 * 60 * 60 * 1000), // 4 horas
          },
        },
      }),
    ]);

    res.json({
      success: true,
      stats: {
        total: totalChats,
        open: openWindows,
        closed: closedWindows,
        expiringSoon,
        openPercentage: totalChats > 0 ? Math.round((openWindows / totalChats) * 100) : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware para verificar se pode enviar mensagem
 * Deve ser usado antes de enviar mensagens não-template
 */
export const checkCanSendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chatId } = req.params;
    const { type = 'TEXT' } = req.body;
    const organizationId = getOrganizationId(req);

    // Templates sempre podem ser enviados
    if (type === 'TEMPLATE') {
      return next();
    }

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, organizationId },
      select: {
        id: true,
        is24hOpen: true,
        windowExpires: true,
        channel: true,
      },
    });

    if (!chat) {
      throw new AppError('Chat not found', 404);
    }

    // Verificar apenas para WhatsApp
    if (chat.channel !== 'WHATSAPP') {
      return next();
    }

    const now = new Date();
    const windowExpired = chat.windowExpires ? now > chat.windowExpires : true;
    const isOpen = chat.is24hOpen && !windowExpired;

    if (!isOpen) {
      throw new AppError(
        'JANELA_24H_FECHADA: A janela de 24h está fechada. Use templates HSM para reabrir.',
        400
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
