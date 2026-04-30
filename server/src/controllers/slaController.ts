import { Request, Response, NextFunction } from 'express';
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

/**
 * Configurações SLA
 * Configura metas de tempo para atendimento
 */
export const getSLAConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);
    const config = await prisma.sLAConfig.findMany({
      where: { organizationId },
      orderBy: { priority: 'asc' },
    });

    res.json({
      success: true,
      config,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSLAConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { firstResponseMinutes, resolutionMinutes, warningThreshold, isActive } = req.body;

    const existing = await prisma.sLAConfig.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('SLA config not found', 404);
    }

    const config = await prisma.sLAConfig.update({
      where: { id: existing.id },
      data: {
        firstResponseMinutes,
        resolutionMinutes,
        warningThreshold: warningThreshold || 80,
        isActive,
        updatedAt: new Date(),
      },
    });

    logger.info(`SLA config updated: ${config.name}`);

    res.json({
      success: true,
      config,
    });
  } catch (error) {
    next(error);
  }
};

export const createSLAConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);
    const { name, priority, firstResponseMinutes, resolutionMinutes, warningThreshold, isDefault } = req.body;

    // Se for default, remover default dos outros
    if (isDefault) {
      await prisma.sLAConfig.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const config = await prisma.sLAConfig.create({
      data: {
        organizationId,
        name,
        priority,
        firstResponseMinutes,
        resolutionMinutes,
        warningThreshold: warningThreshold || 80,
        isDefault: isDefault || false,
        isActive: true,
      },
    });

    logger.info(`SLA config created: ${config.name}`);

    res.status(201).json({
      success: true,
      config,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calcular status SLA de um chat
 */
export const calculateChatSLA = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chatId } = req.params;

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        slaConfig: true,
      },
    });

    if (!chat) {
      throw new AppError('Chat not found', 404);
    }

    // Usar config default se não tiver específica
    const slaConfig = chat.slaConfig || await prisma.sLAConfig.findFirst({
      where: { isDefault: true, isActive: true },
    });

    if (!slaConfig) {
      return res.json({
        success: true,
        sla: null,
        message: 'No SLA configuration found',
      });
    }

    const now = new Date();
    const chatStart = chat.createdAt;
    const firstAgentMessage = chat.messages.find(m => m.sender === 'AGENT' || m.sender === 'BOT');
    
    // Calcular primeira resposta
    let firstResponseTime: number | null = null;
    let firstResponseStatus: 'PENDING' | 'WITHIN_SLA' | 'BREACHED' = 'PENDING';
    
    if (firstAgentMessage) {
      firstResponseTime = (firstAgentMessage.createdAt.getTime() - chatStart.getTime()) / (1000 * 60); // minutos
      const firstResponseSLA = slaConfig.firstResponseMinutes;
      
      if (firstResponseTime <= firstResponseSLA) {
        firstResponseStatus = 'WITHIN_SLA';
      } else {
        firstResponseStatus = 'BREACHED';
      }
    }

    // Calcular tempo total
    const totalTimeMinutes = (now.getTime() - chatStart.getTime()) / (1000 * 60);
    const resolutionSLA = slaConfig.resolutionMinutes;
    
    let resolutionStatus: 'PENDING' | 'WITHIN_SLA' | 'WARNING' | 'BREACHED' = 'PENDING';
    const warningThreshold = (resolutionSLA * (slaConfig.warningThreshold || 80)) / 100;
    
    if (chat.status === 'CLOSED') {
      const lastMessage = chat.messages[chat.messages.length - 1];
      const resolutionTime = (lastMessage.createdAt.getTime() - chatStart.getTime()) / (1000 * 60);
      resolutionStatus = resolutionTime <= resolutionSLA ? 'WITHIN_SLA' : 'BREACHED';
    } else {
      // Chat aberto - verificar status atual
      if (totalTimeMinutes > resolutionSLA) {
        resolutionStatus = 'BREACHED';
      } else if (totalTimeMinutes >= warningThreshold) {
        resolutionStatus = 'WARNING';
      } else {
        resolutionStatus = 'PENDING';
      }
    }

    // Calcular tempo restante
    const remainingMinutes = Math.max(0, resolutionSLA - totalTimeMinutes);
    const remainingTime = {
      hours: Math.floor(remainingMinutes / 60),
      minutes: Math.floor(remainingMinutes % 60),
    };

    // Determinar cor do status
    let statusColor: 'green' | 'yellow' | 'red' = 'green';
    if (resolutionStatus === 'BREACHED' || firstResponseStatus === 'BREACHED') {
      statusColor = 'red';
    } else if (resolutionStatus === 'WARNING') {
      statusColor = 'yellow';
    }

    res.json({
      success: true,
      sla: {
        config: {
          name: slaConfig.name,
          firstResponseMinutes: slaConfig.firstResponseMinutes,
          resolutionMinutes: slaConfig.resolutionMinutes,
        },
        firstResponse: {
          time: firstResponseTime ? Math.round(firstResponseTime) : null,
          status: firstResponseStatus,
          target: slaConfig.firstResponseMinutes,
        },
        resolution: {
          totalTime: Math.round(totalTimeMinutes),
          status: resolutionStatus,
          target: resolutionSLA,
          remainingTime: chat.status !== 'CLOSED' ? remainingTime : null,
        },
        statusColor,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Relatório de SLA
 */
export const getSLAReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { startDate, endDate, agentId } = req.query;

    const where: any = {
      createdAt: {
        gte: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lte: endDate ? new Date(endDate as string) : new Date(),
      },
    };

    if (agentId) {
      where.agentId = agentId;
    }

    // Buscar todos os chats do período com suas mensagens
    const chats = await prisma.chat.findMany({
      where,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        agent: {
          select: { id: true, name: true },
        },
      },
    });

    // Configuração SLA padrão
    const slaConfig = await prisma.sLAConfig.findFirst({
      where: { isDefault: true, isActive: true },
    });

    if (!slaConfig) {
      return res.json({
        success: true,
        report: null,
        message: 'No SLA configuration found',
      });
    }

    // Calcular métricas
    let totalChats = chats.length;
    let firstResponseWithinSLA = 0;
    let firstResponseBreached = 0;
    let resolutionWithinSLA = 0;
    let resolutionBreached = 0;
    let totalFirstResponseTime = 0;
    let totalResolutionTime = 0;
    let firstResponseCount = 0;
    let resolutionCount = 0;

    // Métricas por agente
    const agentMetrics: Record<string, any> = {};

    for (const chat of chats) {
      // Primeira resposta
      const firstAgentMessage = chat.messages.find(m => m.sender === 'AGENT' || m.sender === 'BOT');
      if (firstAgentMessage) {
        const responseTime = (firstAgentMessage.createdAt.getTime() - chat.createdAt.getTime()) / (1000 * 60);
        totalFirstResponseTime += responseTime;
        firstResponseCount++;

        if (responseTime <= slaConfig.firstResponseMinutes) {
          firstResponseWithinSLA++;
        } else {
          firstResponseBreached++;
        }

        // Métricas por agente
        if (chat.agentId) {
          if (!agentMetrics[chat.agentId]) {
            agentMetrics[chat.agentId] = {
              name: chat.agent?.name || 'Unknown',
              chats: 0,
              firstResponseWithinSLA: 0,
              firstResponseBreached: 0,
              totalFirstResponseTime: 0,
            };
          }
          agentMetrics[chat.agentId].chats++;
          agentMetrics[chat.agentId].totalFirstResponseTime += responseTime;
          if (responseTime <= slaConfig.firstResponseMinutes) {
            agentMetrics[chat.agentId].firstResponseWithinSLA++;
          } else {
            agentMetrics[chat.agentId].firstResponseBreached++;
          }
        }
      }

      // Resolução
      if (chat.status === 'CLOSED' && chat.messages.length > 0) {
        const lastMessage = chat.messages[chat.messages.length - 1];
        const resolutionTime = (lastMessage.createdAt.getTime() - chat.createdAt.getTime()) / (1000 * 60);
        totalResolutionTime += resolutionTime;
        resolutionCount++;

        if (resolutionTime <= slaConfig.resolutionMinutes) {
          resolutionWithinSLA++;
        } else {
          resolutionBreached++;
        }
      }
    }

    // Calcular médias
    const avgFirstResponseTime = firstResponseCount > 0 ? totalFirstResponseTime / firstResponseCount : 0;
    const avgResolutionTime = resolutionCount > 0 ? totalResolutionTime / resolutionCount : 0;

    // Calcular porcentagens
    const firstResponseSLARate = firstResponseCount > 0 ? (firstResponseWithinSLA / firstResponseCount) * 100 : 0;
    const resolutionSLARate = resolutionCount > 0 ? (resolutionWithinSLA / resolutionCount) * 100 : 0;

    // Ranking de agentes
    const agentRanking = Object.values(agentMetrics)
      .map((agent: any) => ({
        ...agent,
        avgFirstResponseTime: agent.chats > 0 ? agent.totalFirstResponseTime / agent.chats : 0,
        slaRate: agent.chats > 0 ? (agent.firstResponseWithinSLA / agent.chats) * 100 : 0,
      }))
      .sort((a: any, b: any) => b.slaRate - a.slaRate);

    res.json({
      success: true,
      report: {
        period: {
          start: where.createdAt.gte,
          end: where.createdAt.lte,
        },
        summary: {
          totalChats,
          withFirstResponse: firstResponseCount,
          closed: resolutionCount,
        },
        firstResponse: {
          target: slaConfig.firstResponseMinutes,
          withinSLA: firstResponseWithinSLA,
          breached: firstResponseBreached,
          slaRate: Math.round(firstResponseSLARate * 100) / 100,
          avgTimeMinutes: Math.round(avgFirstResponseTime),
        },
        resolution: {
          target: slaConfig.resolutionMinutes,
          withinSLA: resolutionWithinSLA,
          breached: resolutionBreached,
          slaRate: Math.round(resolutionSLARate * 100) / 100,
          avgTimeMinutes: Math.round(avgResolutionTime),
        },
        agentRanking,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Atribuir config SLA a um chat
 */
export const assignSLAToChat = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { chatId } = req.params;
    const { slaConfigId } = req.body;

    const chat = await prisma.chat.update({
      where: { id: chatId },
      data: { slaConfigId },
      include: {
        slaConfig: true,
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
