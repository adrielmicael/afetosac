import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import { whatsappService } from '../services/whatsappService';
import { logger } from '../utils/logger';
import { processMessage, processFlowResponse } from './chatbotController';

type SocketLike = {
  to: (room: string) => { emit: (event: string, payload: unknown) => void };
  emit: (event: string, payload: unknown) => void;
};

const isValidSignature = (rawBody: string | undefined, signature: string | undefined): boolean => {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  if (!appSecret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('WHATSAPP_APP_SECRET missing in production — rejecting webhook');
      return false;
    }
    logger.warn('WHATSAPP_APP_SECRET not configured; webhook signature validation is disabled (dev only)');
    return true;
  }

  if (!rawBody || !signature) {
    return false;
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`;

  if (expected.length !== signature.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};

// Webhook verification for WhatsApp
export const verifyWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    let result: string | false = false;

    if (mode === 'subscribe' && token && challenge) {
      const organization = await prisma.organization.findFirst({
        where: {
          whatsappWebhookVerifyToken: token,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      if (organization || whatsappService.verifyWebhook(mode, token, challenge)) {
        result = challenge;
      }
    }

    if (result) {
      res.send(result);
    } else {
      res.sendStatus(403);
    }
  } catch (error) {
    next(error);
  }
};

// Receive webhook events from WhatsApp
export const receiveWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    if (!isValidSignature(req.rawBody, signature)) {
      res.status(403).json({ success: false, error: 'Invalid webhook signature' });
      return;
    }

    const body = req.body;
    const socketServer = req.app.get('io') as SocketLike | undefined;

    // Acknowledge receipt immediately
    res.sendStatus(200);

    // Process the webhook data
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const phoneNumberId = change.value?.metadata?.phone_number_id;
          const organization = phoneNumberId
            ? await prisma.organization.findFirst({
                where: {
                  whatsappPhoneNumberId: phoneNumberId,
                  status: 'ACTIVE',
                },
                select: { id: true },
              })
            : null;

          if (!organization) {
            logger.warn(`Webhook ignored: organization not found for phone_number_id ${phoneNumberId}`);
            continue;
          }

          if (change.value.messages) {
            for (const message of change.value.messages) {
              await processIncomingMessage(
                organization.id,
                message,
                change.value.contacts?.[0],
                socketServer
              );
            }
          }

          const statuses = change.value.statuses || change.value.message_statuses || [];
          if (statuses.length > 0) {
            for (const status of statuses) {
              await processMessageStatus(status, socketServer);
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error('Webhook processing error:', error);
    // Already sent 200, log error
  }
};

async function processIncomingMessage(
  organizationId: string,
  message: any,
  contact: any,
  socketServer?: SocketLike
) {
  try {
    const phone = message.from;
    const name = contact?.profile?.name || 'Unknown';
    const metaMessageId: string | undefined = message.id;

    // 🔒 Idempotência: ignorar mensagem já processada
    if (metaMessageId) {
      const alreadyProcessed = await prisma.message.findUnique({
        where: { whatsappMessageId: metaMessageId },
        select: { id: true },
      });
      if (alreadyProcessed) {
        logger.info(`Webhook duplicate ignored: whatsappMessageId=${metaMessageId}`);
        return;
      }
    }

    const now = new Date();
    const windowExpires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h

    // Find or create chat
    let chat = await prisma.chat.findFirst({
      where: { phone, organizationId },
    });

    let windowWasClosed = false;

    if (!chat) {
      // Find patient by phone
      const patient = await prisma.patient.findFirst({
        where: { phone, organizationId },
      });

      chat = await prisma.chat.create({
        data: {
          organizationId,
          phone,
          name,
          channel: 'WHATSAPP',
          status: 'WAITING',
          patientId: patient?.id,
          is24hOpen: true,
          windowExpires,
          lastMessageAt: now,
        },
      });

      logger.info(`New chat created for ${phone}`);
    } else {
      // Check if window was closed before
      windowWasClosed = !chat.is24hOpen || Boolean(chat.windowExpires && now > chat.windowExpires);

      // Update chat - REOPEN 24h WINDOW
      chat = await prisma.chat.update({
        where: { id: chat.id },
        data: {
          lastMessageAt: now,
          unreadCount: { increment: 1 },
          is24hOpen: true,
          windowExpires,
        },
      });

      // Log window reopening
      if (windowWasClosed) {
        logger.info(`24h window REOPENED for chat ${chat.id} (${phone})`);
      }
    }

    // Process message content
    let content = '';
    let type = 'TEXT';
    let mediaUrl = null;
    let fileName = null;
    let duration = null;

    if (message.text) {
      content = message.text.body;
      type = 'TEXT';
    } else if (message.image) {
      content = message.image.caption || 'Imagem recebida';
      type = 'IMAGE';
      mediaUrl = message.image.id;
    } else if (message.audio) {
      content = 'Áudio recebido';
      type = 'AUDIO';
      mediaUrl = message.audio.id;
      duration = message.audio.duration?.toString();
    } else if (message.document) {
      content = message.document.caption || message.document.filename;
      type = 'DOCUMENT';
      mediaUrl = message.document.id;
      fileName = message.document.filename;
    } else if (message.video) {
      content = message.video.caption || 'Vídeo recebido';
      type = 'VIDEO';
      mediaUrl = message.video.id;
    } else if (message.location) {
      content = `Localização: ${message.location.latitude}, ${message.location.longitude}`;
      type = 'LOCATION';
    }

    // Create message
    const newMessage = await prisma.message.create({
      data: {
        chatId: chat.id,
        sender: 'CLIENT',
        type,
        content,
        mediaUrl,
        fileName,
        duration,
        status: 'DELIVERED',
        whatsappMessageId: metaMessageId || null,
      },
      include: {
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

    // Emit to connected clients via Socket.io
    if (socketServer) {
      socketServer.to(`chat:${chat.id}`).emit('message:new', newMessage);
      
      // Notify window reopening
      if (windowWasClosed) {
        socketServer.to(`chat:${chat.id}`).emit('window:reopened', {
          chatId: chat.id,
          windowExpires: windowExpires.toISOString(),
        });
      }
      
      // Notify new chat if just created
      if (chat.unreadCount === 1) {
        socketServer.emit('chat:new', chat);
      }
    }

    logger.info(`Message received from ${phone}: ${content.substring(0, 50)}`);

    // 🤖 CHATBOT INTEGRATION
    // Só processa se for mensagem de texto e chat não tiver agente atribuído
    if (type === 'TEXT' && (!chat.agentId || chat.status === 'WAITING')) {
      // Verificar se já está em um fluxo
      const activeSession = await prisma.chatbotSession.findFirst({
        where: { chatId: chat.id, status: 'ACTIVE' },
      });

      if (activeSession) {
        // Continuar fluxo existente
        await processFlowResponse(chat.id, content);
      } else {
        // Tentar iniciar novo fluxo
        const result = await processMessage(chat.id, content);
        if (result.handled) {
          logger.info(`Chatbot handled message for chat ${chat.id}, flow: ${result.flowName}`);
        }
      }
    }

    return newMessage;
  } catch (error) {
    logger.error('Error processing incoming message:', error);
    throw error;
  }
}

async function processMessageStatus(status: any, socketServer?: SocketLike) {
  try {
    // Update message status in database
    // Note: We need to map WhatsApp message ID to our message ID
    const statusMap: Record<string, string> = {
      'sent': 'SENT',
      'delivered': 'DELIVERED',
      'read': 'READ',
      'failed': 'FAILED',
    };

    if (statusMap[status.status]) {
      const mappedStatus = statusMap[status.status];
      logger.debug(`Message status update: ${status.id} -> ${mappedStatus}`);

      // Persiste status + timestamps de KPI no banco
      const tsUpdate: Record<string, Date> = {};
      if (mappedStatus === 'DELIVERED') tsUpdate.deliveredAt = new Date();
      if (mappedStatus === 'READ')      tsUpdate.readAt = new Date();

      await prisma.message.updateMany({
        where: { whatsappMessageId: status.id },
        data: { status: mappedStatus, ...tsUpdate },
      });

      // Emit status update via socket
      if (socketServer) {
        socketServer.emit('message:status', {
          messageId: status.id,
          status: mappedStatus,
        });
      }
    }
  } catch (error) {
    logger.error('Error processing message status:', error);
  }
}
