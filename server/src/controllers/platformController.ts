import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { PLANS } from './billingController';
import { recordPlatformAudit } from '../services/platformAudit';
import { computeUsageForOrg, currentPeriod } from '../services/usageService';
import { issueImpersonationToken } from '../services/sessionService';
import { provisionOrganization } from './organizationController';

const ORG_STATUSES = ['ACTIVE', 'SUSPENDED', 'CANCELLED'];
const PLAN_IDS = Object.keys(PLANS);

const parsePagination = (req: Request) => {
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
  return { page, limit, skip: (page - 1) * limit };
};

// ===== Visão geral de clínicas =====

export const listOrganizations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const { status, plan, search } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (plan) where.plan = plan;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { slug: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [total, organizations] = await Promise.all([
      prisma.organization.count({ where }),
      prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          status: true,
          whatsappStatus: true,
          trialEndsAt: true,
          createdAt: true,
          _count: { select: { members: true, patients: true } },
          usageMetrics: {
            where: { period: currentPeriod() },
            select: { messagesIn: true, messagesOut: true, chatsTotal: true },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: organizations.map((o) => ({
        ...o,
        mrr: (PLANS as any)[o.plan]?.price ?? 0,
        usage: o.usageMetrics[0] || null,
        usageMetrics: undefined,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const getOrganizationDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        _count: { select: { members: true, patients: true, chats: true } },
        usageMetrics: { orderBy: { period: 'desc' }, take: 6 },
      },
    });
    if (!org) throw new AppError('Organization not found', 404);

    const [pendingLgpd, recentDeadLetters] = await Promise.all([
      prisma.lGPDRequest.count({ where: { organizationId: id, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      prisma.activity.count({ where: { organizationId: id, type: 'DEAD_LETTER' } }),
    ]);

    res.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        plan: org.plan,
        status: org.status,
        limits: { maxUsers: org.maxUsers, maxChats: org.maxChats, maxStorageGB: org.maxStorageGB },
        trialEndsAt: org.trialEndsAt,
        stripeCustomerId: org.stripeCustomerId,
        whatsapp: {
          status: org.whatsappStatus || 'NOT_CONFIGURED',
          lastError: org.whatsappLastError,
          lastCheckedAt: org.whatsappLastCheckedAt,
          configured: Boolean(org.whatsappAccessToken && org.whatsappPhoneNumberId),
        },
        counts: org._count,
        pendingLgpd,
        deadLetters: recentDeadLetters,
        usageHistory: org.usageMetrics,
        mrr: (PLANS as any)[org.plan]?.price ?? 0,
        createdAt: org.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ===== Ciclo de vida =====

export const updateOrganizationStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!ORG_STATUSES.includes(status)) {
      throw new AppError(`Status inválido. Use: ${ORG_STATUSES.join(', ')}`, 400);
    }

    const before = await prisma.organization.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!before) throw new AppError('Organization not found', 404);

    const updated = await prisma.organization.update({
      where: { id },
      data: { status },
      select: { id: true, name: true, status: true },
    });

    await recordPlatformAudit(req, {
      action: 'ORG_STATUS_CHANGE',
      targetType: 'ORGANIZATION',
      targetId: id,
      organizationId: id,
      before: { status: before.status },
      after: { status },
    });

    logger.info(`Org ${id} status ${before.status} -> ${status} by ${req.platformAdmin?.email}`);
    res.json({ success: true, organization: updated });
  } catch (error) {
    next(error);
  }
};

export const updateOrganizationPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { plan, applyLimits = true } = req.body;

    if (!PLAN_IDS.includes(plan)) {
      throw new AppError(`Plano inválido. Use: ${PLAN_IDS.join(', ')}`, 400);
    }

    const before = await prisma.organization.findUnique({
      where: { id },
      select: { plan: true, maxUsers: true, maxChats: true, maxStorageGB: true },
    });
    if (!before) throw new AppError('Organization not found', 404);

    const planDef = (PLANS as any)[plan];
    const data: any = { plan };
    if (applyLimits && planDef) {
      data.maxUsers = planDef.maxUsers;
      data.maxChats = planDef.maxChats;
      data.maxStorageGB = planDef.maxStorageGB;
    }

    const updated = await prisma.organization.update({
      where: { id },
      data,
      select: { id: true, name: true, plan: true, maxUsers: true, maxChats: true, maxStorageGB: true },
    });

    await recordPlatformAudit(req, {
      action: 'ORG_PLAN_CHANGE',
      targetType: 'ORGANIZATION',
      targetId: id,
      organizationId: id,
      before,
      after: { plan, maxUsers: data.maxUsers, maxChats: data.maxChats, maxStorageGB: data.maxStorageGB },
    });

    res.json({ success: true, organization: updated });
  } catch (error) {
    next(error);
  }
};

export const updateOrganizationLimits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { maxUsers, maxChats, maxStorageGB } = req.body;

    const before = await prisma.organization.findUnique({
      where: { id },
      select: { maxUsers: true, maxChats: true, maxStorageGB: true },
    });
    if (!before) throw new AppError('Organization not found', 404);

    const data: any = {};
    if (maxUsers !== undefined) data.maxUsers = Number(maxUsers);
    if (maxChats !== undefined) data.maxChats = Number(maxChats);
    if (maxStorageGB !== undefined) data.maxStorageGB = Number(maxStorageGB);

    if (Object.keys(data).length === 0) {
      throw new AppError('Nenhum limite informado', 400);
    }

    const updated = await prisma.organization.update({ where: { id }, data, select: { id: true, maxUsers: true, maxChats: true, maxStorageGB: true } });

    await recordPlatformAudit(req, {
      action: 'ORG_LIMITS_OVERRIDE',
      targetType: 'ORGANIZATION',
      targetId: id,
      organizationId: id,
      before,
      after: data,
    });

    res.json({ success: true, organization: updated });
  } catch (error) {
    next(error);
  }
};

export const extendTrial = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { days = 14 } = req.body;
    const extraDays = Math.max(1, Math.min(365, Number(days)));

    const org = await prisma.organization.findUnique({ where: { id }, select: { trialEndsAt: true } });
    if (!org) throw new AppError('Organization not found', 404);

    const base = org.trialEndsAt && org.trialEndsAt > new Date() ? org.trialEndsAt : new Date();
    const trialEndsAt = new Date(base.getTime() + extraDays * 86_400_000);

    await prisma.organization.update({ where: { id }, data: { trialEndsAt } });

    await recordPlatformAudit(req, {
      action: 'ORG_TRIAL_EXTEND',
      targetType: 'ORGANIZATION',
      targetId: id,
      organizationId: id,
      before: { trialEndsAt: org.trialEndsAt },
      after: { trialEndsAt },
    });

    res.json({ success: true, trialEndsAt });
  } catch (error) {
    next(error);
  }
};

export const recomputeUsage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const period = (req.query.period as string) || currentPeriod();
    const metric = await computeUsageForOrg(id, period);
    res.json({ success: true, metric });
  } catch (error) {
    next(error);
  }
};

// ===== Provisionamento via plataforma (onboarding controlado) =====

export const createOrganizationByPlatform = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, slug, userEmail, userName, userPassword } = req.body;
    if (!name || !userEmail || !userName) {
      throw new AppError('name, userEmail e userName são obrigatórios', 400);
    }

    // Senha forte gerada quando não informada (entregue uma única vez)
    const generated = !userPassword;
    const password = userPassword || `Af${Math.random().toString(36).slice(-8)}9X`;

    const { organization } = await provisionOrganization({
      name,
      slug,
      userEmail,
      userName,
      userPassword: password,
    });

    await recordPlatformAudit(req, {
      action: 'ORG_CREATE',
      targetType: 'ORGANIZATION',
      targetId: organization.id,
      organizationId: organization.id,
      after: { name, slug: organization.slug, owner: userEmail },
    });

    res.status(201).json({
      success: true,
      organization: { id: organization.id, name: organization.name, slug: organization.slug, plan: organization.plan },
      owner: { email: userEmail, name: userName },
      ...(generated ? { tempPassword: password } : {}),
    });
  } catch (error) {
    next(error);
  }
};

// ===== Impersonação =====

export const impersonateOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const org = await prisma.organization.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!org) throw new AppError('Organization not found', 404);

    // Escolhe o usuário-alvo: informado ou o OWNER ativo da organização
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: id,
        isActive: true,
        ...(userId ? { userId } : { role: 'OWNER' }),
      },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { role: 'asc' },
    });

    if (!membership) throw new AppError('Nenhum usuário elegível para impersonação', 404);

    const { token, expiresAt } = await issueImpersonationToken(req, {
      user: membership.user,
      membership: { role: membership.role, organizationId: id },
      impersonatedBy: req.platformAdmin!.id,
      impersonatorEmail: req.platformAdmin!.email,
    });

    await recordPlatformAudit(req, {
      action: 'IMPERSONATE',
      targetType: 'USER',
      targetId: membership.user.id,
      organizationId: id,
      after: { impersonatedUser: membership.user.email, role: membership.role, expiresAt },
    });

    logger.warn(`IMPERSONATION: ${req.platformAdmin?.email} -> org ${id} as ${membership.user.email}`);
    res.json({
      success: true,
      token,
      expiresAt,
      impersonating: { userId: membership.user.id, email: membership.user.email, role: membership.role, organizationId: id },
    });
  } catch (error) {
    next(error);
  }
};
