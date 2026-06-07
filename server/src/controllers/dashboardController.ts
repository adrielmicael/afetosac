import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';

export const getDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      throw new Error('Organization context required');
    }

    const [
      totalChats,
      activeChats,
      waitingChats,
      totalPatients,
      totalMessages,
      todayMessages,
    ] = await Promise.all([
      prisma.chat.count({ where: { organizationId } }),
      prisma.chat.count({ where: { organizationId, status: 'IN_PROGRESS' } }),
      prisma.chat.count({ where: { organizationId, status: 'WAITING' } }),
      prisma.patient.count({ where: { organizationId, isActive: true } }),
      prisma.message.count({ where: { chat: { organizationId } } }),
      prisma.message.count({
        where: {
          chat: { organizationId },
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    // Agent performance
    const memberships = await prisma.organizationMember.findMany({
      where: {
        organizationId,
        isActive: true,
        role: { in: ['AGENT', 'ADMIN', 'SUPERVISOR', 'OWNER'] },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const agents = await Promise.all(
      memberships.map(async (membership) => {
        const assignedChats = await prisma.chat.count({
          where: {
            organizationId,
            agentId: membership.userId,
            status: { in: ['WAITING', 'IN_PROGRESS'] },
          },
        });

        return {
          id: membership.user.id,
          name: membership.user.name,
          _count: {
            assignedChats,
          },
        };
      })
    );

    // Recent chats
    const recentChats = await prisma.chat.findMany({
      where: { organizationId },
      take: 5,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        agent: { select: { name: true } },
        patient: { select: { name: true } },
        _count: { select: { messages: true } },
      },
    });

    res.json({
      success: true,
      stats: {
        totalChats,
        activeChats,
        waitingChats,
        totalPatients,
        totalMessages,
        todayMessages,
      },
      agents,
      recentChats,
    });
  } catch (error) {
    next(error);
  }
};

export const getReports = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) throw new Error('Organization context required');

    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(String(startDate)) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(String(endDate)) : new Date();
    end.setHours(23, 59, 59, 999);

    const [
      totalChats,
      closedChats,
      totalMessages,
      avgResponseTimeData,
      chatsByDay,
      agentPerformance,
      topPatients,
    ] = await Promise.all([
      prisma.chat.count({ where: { organizationId, createdAt: { gte: start, lte: end } } }),
      prisma.chat.count({ where: { organizationId, status: 'CLOSED', updatedAt: { gte: start, lte: end } } }),
      prisma.message.count({ where: { chat: { organizationId }, createdAt: { gte: start, lte: end } } }),
      // Tempo médio de primeira resposta (em minutos)
      prisma.$queryRaw<{ avg_minutes: number }[]>`
        SELECT COALESCE(AVG(
          EXTRACT(EPOCH FROM (first_reply."createdAt" - c."createdAt")) / 60
        ), 0) as avg_minutes
        FROM "chats" c
        INNER JOIN LATERAL (
          SELECT m."createdAt"
          FROM "messages" m
          WHERE m."chatId" = c.id AND m.sender = 'AGENT'
          ORDER BY m."createdAt" ASC LIMIT 1
        ) first_reply ON true
        WHERE c."organizationId" = ${organizationId}
          AND c."createdAt" >= ${start}
          AND c."createdAt" <= ${end}
      `,
      // Chats por dia
      prisma.$queryRaw<{ day: string; count: bigint }[]>`
        SELECT DATE("createdAt") as day, COUNT(*) as count
        FROM "chats"
        WHERE "organizationId" = ${organizationId}
          AND "createdAt" >= ${start}
          AND "createdAt" <= ${end}
        GROUP BY DATE("createdAt")
        ORDER BY day ASC
      `,
      // Performance por agente
      prisma.organizationMember.findMany({
        where: { organizationId, isActive: true },
        include: { user: { select: { id: true, name: true } } },
      }).then((members) =>
        Promise.all(
          members.map(async (m) => {
            const [handled, closed] = await Promise.all([
              prisma.chat.count({ where: { organizationId, agentId: m.userId, createdAt: { gte: start, lte: end } } }),
              prisma.chat.count({ where: { organizationId, agentId: m.userId, status: 'CLOSED', updatedAt: { gte: start, lte: end } } }),
            ]);
            return { id: m.user.id, name: m.user.name, role: m.role, handled, closed };
          })
        )
      ),
      // Pacientes com mais atendimentos
      prisma.chat.groupBy({
        by: ['patientId'],
        where: { organizationId, patientId: { not: null }, createdAt: { gte: start, lte: end } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }).then((rows) =>
        Promise.all(
          rows.filter((r) => r.patientId).map(async (r) => {
            const patient = await prisma.patient.findUnique({
              where: { id: r.patientId! },
              select: { id: true, name: true },
            });
            return { ...patient, chats: r._count.id };
          })
        )
      ),
    ]);

    const avgMinutes = Number(avgResponseTimeData[0]?.avg_minutes ?? 0);

    res.json({
      success: true,
      period: { start, end },
      summary: {
        totalChats,
        closedChats,
        resolutionRate: totalChats > 0 ? Math.round((closedChats / totalChats) * 100) : 0,
        totalMessages,
        avgFirstResponseMinutes: Math.round(avgMinutes),
      },
      chatsByDay: chatsByDay.map((r) => ({ day: r.day, count: Number(r.count) })),
      agentPerformance,
      topPatients,
    });
  } catch (error) {
    next(error);
  }
};
