import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { broadcastToChat } from '../services/realtimeService';

// Processar mensagem recebida e verificar triggers
export const processMessage = async (chatId: string, messageContent: string) => {
  try {
    const content = messageContent.toLowerCase();
    
    // Buscar fluxos ativos
    const flows = await prisma.chatbotFlow.findMany({
      where: { isActive: true },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    for (const flow of flows) {
      // Verificar triggers
      const parsedTriggers = typeof flow.triggers === 'string' ? JSON.parse(flow.triggers || '[]') : [];
      const triggerMatch = parsedTriggers.some((trigger: string) => 
        content.includes(trigger.toLowerCase())
      );

      if (triggerMatch) {
        await executeFlow(chatId, flow);
        return { handled: true, flowName: flow.name };
      }
    }

    return { handled: false };
  } catch (error) {
    logger.error('Chatbot process error:', error);
    return { handled: false };
  }
};

// Executar fluxo
async function executeFlow(chatId: string, flow: any) {
  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) return;

  // Verificar se já está em um fluxo
  const activeSession = await prisma.chatbotSession.findFirst({
    where: { chatId, status: 'ACTIVE' },
  });

  if (activeSession) return; // Já está em fluxo

  // Criar sessão
  const session = await prisma.chatbotSession.create({
    data: {
      chatId,
      flowId: flow.id,
      currentStepId: flow.steps[0]?.id,
      status: 'ACTIVE',
      data: JSON.stringify({}),
    },
  });

  // Enviar primeira mensagem
  if (flow.steps[0]) {
    await sendBotMessage(chatId, flow.steps[0].message, flow.steps[0].id);
  }
}

// Enviar mensagem do bot
async function sendBotMessage(chatId: string, content: string, stepId?: string) {
  const message = await prisma.message.create({
    data: {
      chatId,
      sender: 'BOT',
      type: 'TEXT',
      content,
      status: 'DELIVERED',
    },
  });

  await broadcastToChat(chatId, 'message:new', message);
  return message;
}

// Processar resposta do usuário em fluxo
export const processFlowResponse = async (chatId: string, response: string) => {
  const session = await prisma.chatbotSession.findFirst({
    where: { chatId, status: 'ACTIVE' },
    include: { currentStep: true, flow: { include: { steps: true } } },
  });

  if (!session || !session.currentStep) return { handled: false };

  const currentStep = session.currentStep;
  const allSteps = session.flow.steps;
  const currentIndex = allSteps.findIndex((s: any) => s.id === currentStep.id);

  // Salvar resposta
  const sessionData = typeof session.data === 'string' && session.data
    ? JSON.parse(session.data)
    : {};
  if (currentStep.fieldName) {
    sessionData[currentStep.fieldName] = response;
  }

  // Verificar próximo passo
  let nextStep = null;
  
  if (currentStep.options) {
    // Se tem opções, verificar qual foi escolhida
    const options = JSON.parse(currentStep.options);
    const selected = options.find((opt: any) => 
      opt.label.toLowerCase() === response.toLowerCase() || 
      opt.value.toLowerCase() === response.toLowerCase()
    );
    
    if (selected?.nextStepId) {
      nextStep = allSteps.find((s: any) => s.id === selected.nextStepId);
    }
  }

  // Se não achou por opção, vai para próximo na ordem
  if (!nextStep && currentIndex < allSteps.length - 1) {
    nextStep = allSteps[currentIndex + 1];
  }

  if (nextStep) {
    await prisma.chatbotSession.update({
      where: { id: session.id },
      data: { 
        currentStepId: nextStep.id,
        data: JSON.stringify(sessionData),
      },
    });

    await sendBotMessage(chatId, nextStep.message, nextStep.id);
    return { handled: true };
  } else {
    // Fim do fluxo
    await prisma.chatbotSession.update({
      where: { id: session.id },
      data: { 
        status: 'COMPLETED',
        data: JSON.stringify(sessionData),
        endedAt: new Date(),
      },
    });

    await sendBotMessage(chatId, 'Obrigado! Em breve um atendente entrará em contato.');
    return { handled: true, completed: true };
  }
};

// CRUD Fluxos
export const getFlows = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const flows = await prisma.chatbotFlow.findMany({
      include: { 
        steps: { orderBy: { order: 'asc' } },
        _count: { select: { sessions: true } },
      },
    });
    res.json({ success: true, flows });
  } catch (error) { next(error); }
};

export const createFlow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, triggers, steps } = req.body;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      throw new AppError('Organization context required', 400);
    }
    
    const flow = await prisma.chatbotFlow.create({
      data: {
        organizationId,
        name,
        description,
        triggers: JSON.stringify(triggers || []),
        isActive: true,
        steps: {
          create: steps.map((step: any, index: number) => ({
            ...step,
            order: index,
          })),
        },
      },
      include: { steps: true },
    });

    res.status(201).json({ success: true, flow });
  } catch (error) { next(error); }
};

export const updateFlow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, description, triggers, isActive } = req.body;
    
    const flow = await prisma.chatbotFlow.update({
      where: { id },
      data: {
        name,
        description,
        triggers: triggers !== undefined ? JSON.stringify(triggers) : undefined,
        isActive,
      },
    });

    res.json({ success: true, flow });
  } catch (error) { next(error); }
};

export const deleteFlow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.chatbotFlow.update({
      where: { id },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Flow deactivated' });
  } catch (error) { next(error); }
};

// Encerrar sessão manualmente (fallback)
export const endSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chatId } = req.params;
    
    await prisma.chatbotSession.updateMany({
      where: { chatId, status: 'ACTIVE' },
      data: { status: 'CANCELLED', endedAt: new Date() },
    });

    await sendBotMessage(chatId, 'Transferindo para um atendente humano...');
    res.json({ success: true });
  } catch (error) { next(error); }
};

// Estatísticas
export const getStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalSessions, completedSessions, activeSessions] = await Promise.all([
      prisma.chatbotSession.count(),
      prisma.chatbotSession.count({ where: { status: 'COMPLETED' } }),
      prisma.chatbotSession.count({ where: { status: 'ACTIVE' } }),
    ]);

    res.json({
      success: true,
      stats: {
        totalSessions,
        completedSessions,
        activeSessions,
        completionRate: totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0,
      },
    });
  } catch (error) { next(error); }
};
