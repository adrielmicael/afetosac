import { Request, Response, NextFunction } from 'express';
import { Prisma } from '../../../src/generated/prisma';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const getOrganizationId = (req: Request): string => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AppError('Organization context required', 400);
  }
  return organizationId;
};

export const getChats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, search } = req.query;
    const organizationId = getOrganizationId(req);

    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '30', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.ChatWhereInput = { organizationId };

    if (status && status !== 'all') {
      where.status = status as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
      ];
    }

    const [total, chats] = await Promise.all([
      prisma.chat.count({ where }),
      prisma.chat.findMany({
        where,
        skip,
        take: limit,
        include: {
          agent: { select: { id: true, name: true, avatar: true } },
          patient: { select: { id: true, name: true, age: true, therapies: true } },
          tags: true,
          _count: { select: { messages: true } },
        },
        orderBy: { lastMessageAt: 'desc' },
      }),
    ]);

    res.json({
      success: true,
      chats,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const getChatById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const chat = await prisma.chat.findFirst({
      where: { id, organizationId },
      include: {
        agent: {
          select: { id: true, name: true, avatar: true },
        },
        // Contato (dono do número) com TODOS os seus pacientes — a atendente
        // escolhe de qual paciente é o atendimento (ex.: vários filhos no mesmo nº)
        contact: {
          include: {
            patients: {
              where: { isActive: true },
              select: { id: true, name: true, age: true, therapies: true },
              orderBy: { name: 'asc' },
            },
          },
        },
        patient: {
          include: {
            therapies: true,
            appointments: {
              where: { status: { in: ['SCHEDULED', 'CONFIRMED'] } },
              orderBy: { date: 'asc' },
              take: 1,
            },
          },
        },
        tags: true,
      },
    });

    if (!chat) {
      throw new AppError('Chat not found', 404);
    }

    res.json({
      success: true,
      chat,
    });
  } catch (error) {
    next(error);
  }
};

export const assignChat = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const agentId = req.user?.id;

    if (!agentId) {
      throw new AppError('Not authenticated', 401);
    }

    const existing = await prisma.chat.findFirst({
      where: { id, organizationId },
      select: { id: true, firstResponseAt: true },
    });

    if (!existing) {
      throw new AppError('Chat not found', 404);
    }

    const chat = await prisma.chat.update({
      where: { id },
      data: {
        agentId,
        status: 'IN_PROGRESS',
        // Registra primeira resposta do agente apenas uma vez
        ...(!existing.firstResponseAt ? { firstResponseAt: new Date() } : {}),
      },
      include: {
        agent: {
          select: { id: true, name: true, avatar: true },
        },
        patient: true,
        tags: true,
      },
    });

    // Add system message
    await prisma.message.create({
      data: {
        chatId: id,
        sender: 'SYSTEM',
        type: 'TEXT',
        content: `Atendimento assumido por ${req.user?.name}`,
        status: 'DELIVERED',
      },
    });

    // Notify via socket
    const io = req.app.get('io');
    io.to(`chat:${id}`).emit('chat:assigned', chat);

    logger.info(`Chat ${id} assigned to ${req.user?.name}`);

    res.json({
      success: true,
      chat,
    });
  } catch (error) {
    next(error);
  }
};

export const transferChat = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { agentId } = req.body;

    const existing = await prisma.chat.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Chat not found', 404);
    }

    const chat = await prisma.chat.update({
      where: { id },
      data: { agentId },
      include: {
        agent: {
          select: { id: true, name: true, avatar: true },
        },
        patient: true,
      },
    });

    // Add system message
    const newAgent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { name: true },
    });

    await prisma.message.create({
      data: {
        chatId: id,
        sender: 'SYSTEM',
        type: 'TEXT',
        content: `Atendimento transferido para ${newAgent?.name}`,
        status: 'DELIVERED',
      },
    });

    const io = req.app.get('io');
    io.to(`chat:${id}`).emit('chat:transferred', chat);

    logger.info(`Chat ${id} transferred to ${agentId}`);

    res.json({
      success: true,
      chat,
    });
  } catch (error) {
    next(error);
  }
};

export const closeChat = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const existing = await prisma.chat.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Chat not found', 404);
    }

    const chat = await prisma.chat.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date() },
      include: {
        agent: {
          select: { id: true, name: true, avatar: true },
        },
        patient: true,
      },
    });

    // Add system message
    await prisma.message.create({
      data: {
        chatId: id,
        sender: 'SYSTEM',
        type: 'TEXT',
        content: 'Atendimento finalizado',
        status: 'DELIVERED',
      },
    });

    const io = req.app.get('io');
    io.to(`chat:${id}`).emit('chat:closed', chat);

    logger.info(`Chat ${id} closed`);

    res.json({
      success: true,
      chat,
    });
  } catch (error) {
    next(error);
  }
};

export const updateChatTags = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { tagIds } = req.body;

    const existing = await prisma.chat.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Chat not found', 404);
    }

    const chat = await prisma.chat.update({
      where: { id },
      data: {
        tags: {
          set: tagIds.map((tagId: string) => ({ id: tagId })),
        },
      },
      include: {
        tags: true,
      },
    });

    res.json({
      success: true,
      chat,
    });
  } catch (error) {
    next(error);
  }
};

export const linkPatient = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { patientId } = req.body;

    const existingChat = await prisma.chat.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!existingChat) {
      throw new AppError('Chat not found', 404);
    }

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, organizationId },
      select: { id: true },
    });

    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    const chat = await prisma.chat.update({
      where: { id },
      data: { patientId },
      include: {
        patient: {
          include: {
            therapies: true,
          },
        },
      },
    });

    const io = req.app.get('io');
    io.to(`chat:${id}`).emit('chat:patientLinked', chat);

    res.json({
      success: true,
      chat,
    });
  } catch (error) {
    next(error);
  }
};
