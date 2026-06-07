import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { PLANS } from './billingController';
import { currentPeriod } from '../services/usageService';

const planPrice = (plan: string): number => (PLANS as any)[plan]?.price ?? 0;

const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

// ===== Visão geral da plataforma =====

export const getOverview = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [byStatus, byPlanActive, trialsExpiring, period] = await Promise.all([
      prisma.organization.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.organization.groupBy({ by: ['plan'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
      prisma.organization.count({
        where: { status: 'ACTIVE', trialEndsAt: { gte: new Date(), lte: daysFromNow(7) } },
      }),
      Promise.resolve(currentPeriod()),
    ]);

    const statusCounts = byStatus.reduce((acc, s) => {
      acc[s.status] = s._count._all;
      return acc;
    }, {} as Record<string, number>);

    const mrr = byPlanActive.reduce((sum, p) => sum + planPrice(p.plan) * p._count._all, 0);

    const usageAgg = await prisma.usageMetric.aggregate({
      where: { period },
      _sum: { messagesIn: true, messagesOut: true, chatsTotal: true },
    });

    res.json({
      success: true,
      overview: {
        organizations: {
          total: byStatus.reduce((sum, s) => sum + s._count._all, 0),
          active: statusCounts.ACTIVE || 0,
          suspended: statusCounts.SUSPENDED || 0,
          cancelled: statusCounts.CANCELLED || 0,
        },
        revenue: { mrr, arr: mrr * 12, currency: 'BRL' },
        trialsExpiring7d: trialsExpiring,
        usageThisPeriod: {
          period,
          messagesIn: usageAgg._sum.messagesIn || 0,
          messagesOut: usageAgg._sum.messagesOut || 0,
          chats: usageAgg._sum.chatsTotal || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ===== Billing oversight =====

export const getBilling = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [byPlanActive, cancelledRecently, trials] = await Promise.all([
      prisma.organization.groupBy({ by: ['plan'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
      prisma.organization.count({ where: { status: 'CANCELLED', updatedAt: { gte: daysAgo(30) } } }),
      prisma.organization.findMany({
        where: { status: 'ACTIVE', trialEndsAt: { gte: new Date(), lte: daysFromNow(14) } },
        select: { id: true, name: true, slug: true, plan: true, trialEndsAt: true },
        orderBy: { trialEndsAt: 'asc' },
      }),
    ]);

    const totalActive = byPlanActive.reduce((sum, p) => sum + p._count._all, 0);
    const mrr = byPlanActive.reduce((sum, p) => sum + planPrice(p.plan) * p._count._all, 0);

    res.json({
      success: true,
      billing: {
        mrr,
        arr: mrr * 12,
        currency: 'BRL',
        churnLast30d: cancelledRecently,
        churnRate: totalActive > 0 ? +(cancelledRecently / (totalActive + cancelledRecently)).toFixed(4) : 0,
        byPlan: byPlanActive.map((p) => ({
          plan: p.plan,
          count: p._count._all,
          unitPrice: planPrice(p.plan),
          subtotal: planPrice(p.plan) * p._count._all,
        })),
        trialsExpiring: trials,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ===== Saúde operacional (cross-tenant) =====

export const getOperationsHealth = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [deadLetters, whatsappErrors, stuckJobs, recentDeadLetters] = await Promise.all([
      prisma.activity.count({ where: { type: 'DEAD_LETTER', createdAt: { gte: daysAgo(7) } } }),
      prisma.organization.findMany({
        where: { whatsappStatus: 'ERROR' },
        select: { id: true, name: true, slug: true, whatsappLastError: true, whatsappLastCheckedAt: true },
        take: 50,
      }),
      prisma.jobQueue.count({ where: { status: { in: ['pending', 'failed'] }, createdAt: { lt: daysAgo(1) } } }),
      prisma.activity.findMany({
        where: { type: 'DEAD_LETTER' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, organizationId: true, description: true, createdAt: true },
      }),
    ]);

    res.json({
      success: true,
      operations: {
        deadLetters7d: deadLetters,
        whatsappErrors: whatsappErrors.length,
        whatsappErrorOrgs: whatsappErrors,
        stuckJobs,
        recentDeadLetters,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ===== LGPD global com SLA legal (15 dias) =====

export const getLgpdRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const { status } = req.query;

    const where: any = {};
    if (status) where.status = status;

    const slaDeadlineDays = 15;
    const overdueThreshold = daysAgo(slaDeadlineDays);

    const [total, requests, overdue] = await Promise.all([
      prisma.lGPDRequest.count({ where }),
      prisma.lGPDRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { requestedAt: 'asc' },
        include: { organization: { select: { name: true, slug: true } } },
      }),
      prisma.lGPDRequest.count({
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] }, requestedAt: { lt: overdueThreshold } },
      }),
    ]);

    res.json({
      success: true,
      slaDeadlineDays,
      overdueCount: overdue,
      data: requests.map((r) => {
        const deadline = new Date(r.requestedAt.getTime() + slaDeadlineDays * 86_400_000);
        const open = r.status === 'PENDING' || r.status === 'IN_PROGRESS';
        return {
          id: r.id,
          protocol: r.protocol,
          type: r.type,
          status: r.status,
          organization: r.organization,
          requestedAt: r.requestedAt,
          deadline,
          overdue: open && deadline < new Date(),
        };
      }),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};
