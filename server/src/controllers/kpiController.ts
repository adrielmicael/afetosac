/**
 * KPI de Qualidade — Lote 5 / Trilha Parceiro Meta
 *
 * Expõe métricas que a Meta exige como evidência para candidatura a parceiro formal:
 *   - Taxa de entrega (delivery rate)
 *   - Taxa de leitura (read rate)
 *   - Tempo médio de primeira resposta (avg first response time)
 *   - Volume de erros de webhook (dead-letter)
 *   - Janela de tempo dos dados
 */
import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';

/** Retorna KPIs de qualidade para a organização autenticada.
 *  Query params: days=30 (padrão: últimos 30 dias)
 */
export const getQualityKpis = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      res.status(401).json({ success: false, message: 'Organization context required' });
      return;
    }

    const days = Math.min(parseInt(String(req.query.days ?? '30'), 10) || 30, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // ----------------------------------------------------------------
    // 1. Mensagens outbound (AGENT ou BOT) enviadas no período
    // ----------------------------------------------------------------
    const [totalOutbound, delivered, read] = await Promise.all([
      prisma.message.count({
        where: {
          chat: { organizationId },
          sender: { in: ['AGENT', 'BOT'] },
          status: { in: ['SENT', 'DELIVERED', 'READ'] },
          createdAt: { gte: since },
        },
      }),
      prisma.message.count({
        where: {
          chat: { organizationId },
          sender: { in: ['AGENT', 'BOT'] },
          status: { in: ['DELIVERED', 'READ'] },
          createdAt: { gte: since },
        },
      }),
      prisma.message.count({
        where: {
          chat: { organizationId },
          sender: { in: ['AGENT', 'BOT'] },
          status: 'READ',
          createdAt: { gte: since },
        },
      }),
    ]);

    const deliveryRate = totalOutbound > 0
      ? parseFloat(((delivered / totalOutbound) * 100).toFixed(2))
      : null;

    const readRate = totalOutbound > 0
      ? parseFloat(((read / totalOutbound) * 100).toFixed(2))
      : null;

    // ----------------------------------------------------------------
    // 2. Tempo médio de primeira resposta (chats encerrados no período)
    // ----------------------------------------------------------------
    const closedChats = await prisma.chat.findMany({
      where: {
        organizationId,
        status: 'CLOSED',
        closedAt: { gte: since },
        firstResponseAt: { not: null },
      },
      select: {
        createdAt: true,
        firstResponseAt: true,
      },
    });

    let avgFirstResponseSeconds: number | null = null;
    if (closedChats.length > 0) {
      const totalMs = closedChats.reduce((acc, c) => {
        return acc + (c.firstResponseAt!.getTime() - c.createdAt.getTime());
      }, 0);
      avgFirstResponseSeconds = Math.round(totalMs / closedChats.length / 1000);
    }

    // ----------------------------------------------------------------
    // 3. Erros de webhook (dead-letter registrados na Activity)
    // ----------------------------------------------------------------
    const webhookErrors = await prisma.activity.count({
      where: {
        organizationId,
        type: 'DEAD_LETTER',
        createdAt: { gte: since },
      },
    });

    // ----------------------------------------------------------------
    // 4. Throughput: chats abertos vs encerrados no período
    // ----------------------------------------------------------------
    const [chatsOpened, chatsClosed] = await Promise.all([
      prisma.chat.count({
        where: { organizationId, createdAt: { gte: since } },
      }),
      prisma.chat.count({
        where: { organizationId, closedAt: { gte: since } },
      }),
    ]);

    res.json({
      success: true,
      period: { days, since: since.toISOString() },
      kpis: {
        delivery: {
          totalOutbound,
          delivered,
          deliveryRate,
          unit: '%',
          description: 'Mensagens entregues / mensagens enviadas',
        },
        reading: {
          read,
          readRate,
          unit: '%',
          description: 'Mensagens lidas / mensagens enviadas',
        },
        firstResponse: {
          chatsAnalyzed: closedChats.length,
          avgFirstResponseSeconds,
          description: 'Tempo médio entre criação do chat e primeira resposta do agente',
        },
        webhookErrors: {
          count: webhookErrors,
          description: 'Webhooks que entraram em dead-letter no período',
        },
        throughput: {
          chatsOpened,
          chatsClosed,
          description: 'Chats abertos e encerrados no período',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
