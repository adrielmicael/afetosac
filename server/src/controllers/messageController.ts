import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { whatsappService } from '../services/whatsappService';
import { logger } from '../utils/logger';

type OutboundTemplateInput = {
  templateName: string;
  variables?: string[];
  senderId?: string;
  correlationId?: string;
};

const extractWhatsAppMessageId = (response: any): string | null => {
  if (!response || typeof response !== 'object') return null;
  const first = Array.isArray(response.messages) ? response.messages[0] : null;
  const id = first?.id;
  return typeof id === 'string' ? id : null;
};

const recordDeadLetter = async (params: {
  organizationId: string;
  userId?: string;
  queue: 'whatsapp' | 'template';
  chatId: string;
  messageId: string;
  payload: Record<string, unknown>;
  error: unknown;
  correlationId?: string;
}) => {
  const {
    organizationId,
    userId,
    queue,
    chatId,
    messageId,
    payload,
    error,
    correlationId,
  } = params;

  const err = error as { message?: string };
  await prisma.activity.create({
    data: {
      organizationId,
      userId: userId || 'system',
      type: 'DEAD_LETTER',
      description: `Falha permanente de envio (${queue}) para chat ${chatId}`,
      metadata: JSON.stringify({
        queue,
        chatId,
        messageId,
        payload,
        error: err?.message || 'unknown_error',
        correlationId,
        failedAt: new Date().toISOString(),
      }),
    },
  });
};

const sendTemplateOutbound = async (
  chatId: string,
  organizationId: string,
  chatPhone: string,
  templateInput: OutboundTemplateInput
) => {
  const { templateName, variables = [], senderId, correlationId } = templateInput;

  const template = await prisma.template.findFirst({
    where: { organizationId, name: templateName, isActive: true },
    select: { id: true, name: true, category: true },
  });

  if (!template) {
    throw new AppError('Template not found or inactive', 404);
  }

  const chat = await prisma.chat.findFirst({
    where: { id: chatId, organizationId },
    select: { patientId: true },
  });

  if (template.category === 'MARKETING' && chat?.patientId) {
    const marketingConsent = await prisma.consent.findFirst({
      where: {
        patientId: chat.patientId,
        type: 'MARKETING',
        granted: true,
        revokedAt: null,
      },
      select: { id: true },
    });

    if (!marketingConsent) {
      throw new AppError(
        'CONSENTIMENTO_MARKETING_AUSENTE: Paciente não deu opt-in para comunicações de marketing. Registre o consentimento antes de enviar.',
        403
      );
    }
  }

  const message = await prisma.message.create({
    data: {
      chatId,
      sender: 'BOT',
      senderId: senderId || null,
      type: 'TEMPLATE',
      content: `Template: ${template.name}`,
      templateId: template.id,
      status: 'SENDING',
    },
    include: {
      senderUser: {
        select: { id: true, name: true, avatar: true },
      },
    },
  });

  try {
    const response = await whatsappService.sendTemplate(chatPhone, template.name, variables);
    const whatsappMessageId = extractWhatsAppMessageId(response);

    await prisma.message.update({
      where: { id: message.id },
      data: {
        status: 'DELIVERED',
        ...(whatsappMessageId ? { whatsappMessageId } : {}),
      },
    });

    message.status = 'DELIVERED';
    if (whatsappMessageId) {
      message.whatsappMessageId = whatsappMessageId;
    }
  } catch (error) {
    logger.error('Failed to send template:', error);

    await prisma.message.update({
      where: { id: message.id },
      data: { status: 'FAILED' },
    });

    await recordDeadLetter({
      organizationId,
      userId: senderId,
      queue: 'template',
      chatId,
      messageId: message.id,
      payload: {
        chatPhone,
        templateName: template.name,
        variables,
      },
      error,
      correlationId,
    });

    message.status = 'FAILED';
  }

  await prisma.chat.update({
    where: { id: chatId },
    data: { lastMessageAt: new Date() },
  });

  return message;
};

const getOrganizationId = (req: Request): string => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AppError('Organization context required', 400);
  }
  return organizationId;
};

export const getMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chatId } = req.params;
    const { limit = '50', before } = req.query;
    const organizationId = getOrganizationId(req);

    const where: any = {
      chatId,
      chat: { organizationId },
    };

    if (before) {
      where.createdAt = { lt: new Date(before as string) };
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      include: {
        senderUser: {
          select: { id: true, name: true, avatar: true },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: true,
            type: true,
          },
        },
      },
    });

    res.json({
      success: true,
      messages: messages.reverse(),
    });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chatId } = req.params;
    const {
      content,
      type = 'TEXT',
      isInternal = false,
      replyToId,
      templateName,
      variables,
    } = req.body;
    const senderId = req.user?.id;
    const organizationId = getOrganizationId(req);

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, organizationId },
    });

    if (!chat) {
      throw new AppError('Chat not found', 404);
    }

    if (!isInternal && type === 'TEMPLATE') {
      throw new AppError(
        'Use o endpoint /messages/:chatId/template para envio de template HSM.',
        400
      );
    }

    const allowedOutboundTypes = new Set(['TEXT', 'IMAGE', 'DOCUMENT']);
    if (!isInternal && !allowedOutboundTypes.has(type)) {
      throw new AppError('Tipo de mensagem não suportado para envio outbound.', 400);
    }

    // Politica de janela 24h: fora da janela, apenas template HSM.
    if (!isInternal && chat.channel === 'WHATSAPP' && type !== 'TEMPLATE') {
      const now = new Date();
      const windowExpired = chat.windowExpires ? now > chat.windowExpires : true;
      const isWindowOpen = chat.is24hOpen && !windowExpired;

      if (!isWindowOpen) {
        if (!templateName) {
          throw new AppError(
            'JANELA_24H_FECHADA: Não é possível enviar mensagens fora da janela de 24h. Use templates HSM para reabrir a conversa.',
            400
          );
        }

        const fallbackTemplateMessage = await sendTemplateOutbound(
          chatId,
          organizationId,
          chat.phone,
          {
            templateName,
            variables,
            senderId,
            correlationId: req.correlationId,
          }
        );

        const io = req.app.get('io');
        io.to(`chat:${chatId}`).emit('message:new', fallbackTemplateMessage);

        return res.json({
          success: true,
          message: fallbackTemplateMessage,
          windowPolicy: 'template_fallback',
        });
      }
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        chatId,
        sender: isInternal ? 'AGENT' : 'BOT',
        senderId: isInternal ? senderId : null,
        type,
        content,
        isInternal,
        replyToId: replyToId || null,
        status: isInternal ? 'SAVED' : 'SENDING',
      },
      include: {
        senderUser: {
          select: { id: true, name: true, avatar: true },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: true,
            type: true,
          },
        },
      },
    });

    // Update chat last message
    await prisma.chat.update({
      where: { id: chatId },
      data: {
        lastMessageAt: new Date(),
      },
    });

    // Send to WhatsApp if not internal
    if (!isInternal) {
      try {
        const response = await whatsappService.sendMessage(chat.phone, content, type);
        const whatsappMessageId = extractWhatsAppMessageId(response);

        await prisma.message.update({
          where: { id: message.id },
          data: {
            status: 'DELIVERED',
            ...(whatsappMessageId ? { whatsappMessageId } : {}),
          },
        });

        message.status = 'DELIVERED';
        if (whatsappMessageId) {
          message.whatsappMessageId = whatsappMessageId;
        }
      } catch (error) {
        logger.error('Failed to send WhatsApp message:', error);

        await prisma.message.update({
          where: { id: message.id },
          data: { status: 'FAILED' },
        });

        await recordDeadLetter({
          organizationId,
          userId: senderId,
          queue: 'whatsapp',
          chatId,
          messageId: message.id,
          payload: {
            phone: chat.phone,
            type,
            content,
          },
          error,
          correlationId: req.correlationId,
        });

        message.status = 'FAILED';
      }
    }

    // Notify via socket
    const io = req.app.get('io');
    io.to(`chat:${chatId}`).emit('message:new', message);

    res.json({
      success: true,
      message,
    });
  } catch (error) {
    next(error);
  }
};

export const sendTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chatId } = req.params;
    const { templateName, variables } = req.body;
    const senderId = req.user?.id;
    const organizationId = getOrganizationId(req);

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, organizationId },
    });

    if (!chat) {
      throw new AppError('Chat not found', 404);
    }

    const message = await sendTemplateOutbound(chatId, organizationId, chat.phone, {
      templateName,
      variables,
      senderId,
      correlationId: req.correlationId,
    });

    // Notify via socket
    const io = req.app.get('io');
    io.to(`chat:${chatId}`).emit('message:new', message);

    res.json({
      success: true,
      message,
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chatId } = req.params;
    const organizationId = getOrganizationId(req);

    await prisma.message.updateMany({
      where: {
        chatId,
        chat: { organizationId },
        sender: 'CLIENT',
        status: { in: ['DELIVERED', 'SENT'] },
      },
      data: { status: 'READ' },
    });

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, organizationId },
      select: { id: true },
    });

    if (!chat) {
      throw new AppError('Chat not found', 404);
    }

    await prisma.chat.update({
      where: { id: chat.id },
      data: { unreadCount: 0 },
    });

    const io = req.app.get('io');
    io.to(`chat:${chatId}`).emit('messages:read', { chatId });

    res.json({
      success: true,
    });
  } catch (error) {
    next(error);
  }
};
