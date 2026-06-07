import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { slugify } from '../utils/slugify';
import { encrypt, encryptIfNeeded, maskSecret } from '../utils/crypto';
import { hashPassword, validatePasswordStrength } from '../utils/password';
import { issueSession } from '../services/sessionService';
import { assertCanAddUser } from '../services/planLimitService';
import { testClinicConnection, syncPatientsFromClinic } from '../services/clinicSupabaseService';

/**
 * Núcleo de provisionamento de uma organização (usuário OWNER + org + SLA padrão).
 * Reutilizado pelo onboarding público e pela criação via painel de plataforma.
 */
export const provisionOrganization = async (params: {
  name: string;
  slug?: string;
  userEmail: string;
  userName: string;
  userPassword: string;
}) => {
  const { name, slug, userEmail, userName, userPassword } = params;
  const cleanSlug = slugify(slug || name);

  const existing = await prisma.organization.findUnique({ where: { slug: cleanSlug } });
  if (existing) {
    throw new AppError('Organization slug already exists', 400);
  }

  const existingUser = await prisma.user.findUnique({ where: { email: userEmail } });
  if (existingUser) {
    throw new AppError('E-mail já cadastrado', 400);
  }

  validatePasswordStrength(userPassword);
  const hashedPassword = await hashPassword(userPassword);

  const user = await prisma.user.create({
    data: { email: userEmail, name: userName, password: hashedPassword },
  });

  const organization = await prisma.organization.create({
    data: {
      name,
      slug: cleanSlug,
      plan: 'FREE',
      members: { create: { userId: user.id, role: 'OWNER' } },
    },
  });

  await prisma.sLAConfig.create({
    data: {
      organizationId: organization.id,
      name: 'Padrão',
      firstResponseMinutes: 15,
      resolutionMinutes: 240,
      isDefault: true,
    },
  });

  logger.info(`Organization provisioned: ${organization.name} (${organization.slug})`);
  return { organization, user };
};

// Criar nova organização (onboarding público — controlado por flag)
export const createOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Onboarding controlado: por padrão fechado em produção.
    // Habilite explicitamente com ALLOW_PUBLIC_SIGNUP=true.
    if (process.env.ALLOW_PUBLIC_SIGNUP !== 'true') {
      throw new AppError(
        'Cadastro público desabilitado. Solicite acesso ao suporte da plataforma.',
        403
      );
    }

    const { name, slug, userEmail, userName, userPassword } = req.body;

    if (!name || !userEmail || !userName || !userPassword) {
      throw new AppError('name, userEmail, userName e userPassword são obrigatórios', 400);
    }

    const { organization, user } = await provisionOrganization({
      name,
      slug,
      userEmail,
      userName,
      userPassword,
    });

    // Emite sessão real (jti + DeviceSession + cookie) para o OWNER recém-criado
    const session = await issueSession(req, res, user, {
      role: 'OWNER',
      organizationId: organization.id,
    });

    res.status(201).json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        plan: organization.plan,
      },
      user: session.user,
      token: session.token,
    });
  } catch (error) {
    next(error);
  }
};

// Listar organizações do usuário
export const listUserOrganizations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    const memberships = await prisma.organizationMember.findMany({
      where: { userId, isActive: true },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            plan: true,
            status: true,
          }
        }
      },
      orderBy: { lastAccessAt: 'desc' }
    });

    res.json({
      success: true,
      organizations: memberships.map(m => ({
        ...m.organization,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// Obter detalhes da organização atual
export const getCurrentOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = (req as any).tenant?.id || req.user?.membership?.organizationId;

    if (!organizationId) {
      throw new AppError('No organization selected', 400);
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: {
          select: {
            members: true,
            patients: true,
            chats: { where: { status: { not: 'CLOSED' } } },
          }
        }
      }
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    res.json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        domain: organization.domain,
        logoUrl: organization.logoUrl,
        primaryColor: organization.primaryColor,
        plan: organization.plan,
        status: organization.status,
        settings: organization.settings ? JSON.parse(organization.settings) : {},
        limits: {
          maxUsers: organization.maxUsers,
          maxChats: organization.maxChats,
          maxStorageGB: organization.maxStorageGB,
        },
        counts: organization._count,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Atualizar organização
export const updateOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = (req as any).tenant?.id;
    const { name, logoUrl, primaryColor, settings } = req.body;

    const organization = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        name,
        logoUrl,
        primaryColor,
        settings: settings ? JSON.stringify(settings) : undefined,
      }
    });

    res.json({
      success: true,
      organization,
    });
  } catch (error) {
    next(error);
  }
};

// Obter configuração WhatsApp (segredos mascarados)
export const getWhatsAppConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = (req as any).tenant?.id;

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        whatsappApiUrl: true,
        whatsappAccessToken: true,
        whatsappPhoneNumberId: true,
        whatsappWebhookVerifyToken: true,
        whatsappAppSecret: true,
        whatsappStatus: true,
        whatsappLastError: true,
        whatsappLastCheckedAt: true,
      },
    });

    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    res.json({
      success: true,
      whatsapp: {
        apiUrl: org.whatsappApiUrl,
        phoneNumberId: org.whatsappPhoneNumberId,
        // segredos nunca retornam em texto puro
        accessToken: maskSecret(org.whatsappAccessToken),
        webhookVerifyToken: maskSecret(org.whatsappWebhookVerifyToken),
        appSecret: maskSecret(org.whatsappAppSecret),
        configured: Boolean(org.whatsappAccessToken && org.whatsappPhoneNumberId),
        status: org.whatsappStatus || 'NOT_CONFIGURED',
        lastError: org.whatsappLastError,
        lastCheckedAt: org.whatsappLastCheckedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Atualizar configuração WhatsApp (segredos cifrados em repouso)
export const updateWhatsAppConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = (req as any).tenant?.id;
    const {
      apiUrl,
      phoneNumberId,
      accessToken,
      webhookVerifyToken,
      appSecret,
    } = req.body;

    const data: Record<string, unknown> = {};

    if (apiUrl !== undefined) data.whatsappApiUrl = apiUrl || null;
    if (phoneNumberId !== undefined) data.whatsappPhoneNumberId = phoneNumberId || null;
    // Verify token fica em texto puro: é usado em lookup por igualdade no handshake
    // e tem baixa sensibilidade (não concede acesso à API).
    if (webhookVerifyToken !== undefined) data.whatsappWebhookVerifyToken = webhookVerifyToken || null;
    // Segredos sensíveis são cifrados em repouso (só re-cifra quando um novo valor é enviado)
    if (accessToken) data.whatsappAccessToken = encryptIfNeeded(accessToken);
    if (appSecret) data.whatsappAppSecret = encryptIfNeeded(appSecret);

    if (Object.keys(data).length === 0) {
      throw new AppError('Nenhum campo de configuração informado', 400);
    }

    data.whatsappStatus = 'CONFIGURED';
    data.whatsappLastCheckedAt = new Date();

    await prisma.organization.update({
      where: { id: organizationId },
      data,
    });

    logger.info(`WhatsApp config updated for org ${organizationId}`);

    res.json({
      success: true,
      message: 'Configuração do WhatsApp atualizada',
    });
  } catch (error) {
    next(error);
  }
};

// Obter config da integração Afeto Clinic (segredo mascarado)
export const getAfetoClinicConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = (req as any).tenant?.id;
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        externalId: true,
        afetoClinicEnabled: true,
        afetoClinicSecret: true,
        afetoClinicSupabaseUrl: true,
        afetoClinicSupabaseKey: true,
      },
    });
    if (!org) throw new AppError('Organization not found', 404);

    res.json({
      success: true,
      afetoClinic: {
        externalId: org.externalId,
        enabled: org.afetoClinicEnabled,
        configured: Boolean(org.afetoClinicSecret),
        secret: maskSecret(org.afetoClinicSecret),
        // Leitura via Supabase REST por tenant
        supabaseUrl: org.afetoClinicSupabaseUrl,
        supabaseKey: maskSecret(org.afetoClinicSupabaseKey),
        supabaseConfigured: Boolean(org.afetoClinicSupabaseUrl && org.afetoClinicSupabaseKey),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Atualizar config da integração (externalId, habilitar, (re)gerar segredo)
export const updateAfetoClinicConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = (req as any).tenant?.id;
    const { externalId, enabled, regenerateSecret, supabaseUrl, supabaseKey } = req.body;

    const current = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { afetoClinicSecret: true },
    });
    if (!current) throw new AppError('Organization not found', 404);

    const data: Record<string, unknown> = {};
    if (externalId !== undefined) data.externalId = externalId || null;
    if (enabled !== undefined) data.afetoClinicEnabled = Boolean(enabled);
    // Config de leitura via Supabase REST (a chave é cifrada em repouso)
    if (supabaseUrl !== undefined) data.afetoClinicSupabaseUrl = supabaseUrl || null;
    if (supabaseKey) data.afetoClinicSupabaseKey = encryptIfNeeded(supabaseKey);

    // Gera um segredo novo se solicitado ou se ainda não existe
    let plaintextSecret: string | null = null;
    if (regenerateSecret || !current.afetoClinicSecret) {
      plaintextSecret = `afc_${crypto.randomBytes(24).toString('base64url')}`;
      data.afetoClinicSecret = encrypt(plaintextSecret);
    }

    if (Object.keys(data).length === 0) {
      throw new AppError('Nenhum campo informado', 400);
    }

    await prisma.organization.update({ where: { id: organizationId }, data });
    logger.info(`Afeto Clinic integration updated for org ${organizationId}`);

    res.json({
      success: true,
      message: 'Integração Afeto Clinic atualizada',
      // o segredo é retornado UMA ÚNICA VEZ quando (re)gerado
      ...(plaintextSecret ? { secret: plaintextSecret } : {}),
    });
  } catch (error) {
    next(error);
  }
};

// Testar conexão com o Supabase do Afeto Clinic (por tenant)
export const testAfetoClinicSupabase = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = (req as any).tenant?.id;
    const table = (req.query.table as string) || 'patients';
    const result = await testClinicConnection(organizationId, table);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// Sincronizar pacientes a partir do Supabase do Afeto Clinic
export const syncAfetoClinicPatients = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = (req as any).tenant?.id;
    const table = (req.body?.table as string) || 'patients';
    const dryRun = Boolean(req.body?.dryRun);
    const result = await syncPatientsFromClinic(organizationId, table, { dryRun });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// Convidar membro
export const inviteMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = (req as any).tenant?.id;
    const { email, name, role } = req.body;

    // Verificar se email já existe na org
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await prisma.organizationMember.findFirst({
        where: { organizationId, userId: existingUser.id }
      });
      if (existingMember) {
        throw new AppError('User is already a member of this organization', 400);
      }
    }

    // Enforcement de plano: respeita o limite de usuários
    await assertCanAddUser(organizationId);

    // Criar usuário se não existir
    let user = existingUser;
    if (!user) {
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          password: await hashPassword(tempPassword),
        }
      });
      // TODO: Enviar email de convite com link para definir senha
    }

    // Adicionar à organização
    const member = await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: user.id,
        role: role || 'AGENT',
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatar: true }
        }
      }
    });

    logger.info(`Member invited: ${email} to org ${organizationId}`);

    res.status(201).json({
      success: true,
      member: {
        ...member,
        user: member.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Listar membros
export const listMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = (req as any).tenant?.id;

    const members = await prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: { id: true, email: true, name: true, avatar: true, isActive: true, lastLoginAt: true }
        }
      },
      orderBy: { joinedAt: 'desc' }
    });

    res.json({
      success: true,
      members: members.map(m => ({
        id: m.id,
        role: m.role,
        isActive: m.isActive,
        joinedAt: m.joinedAt,
        lastAccessAt: m.lastAccessAt,
        user: m.user,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// Remover membro
export const removeMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = (req as any).tenant?.id;
    const { memberId } = req.params;

    // Verificar se não está removendo a si mesmo
    const member = await prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId }
    });

    if (!member) {
      throw new AppError('Member not found', 404);
    }

    if (member.role === 'OWNER') {
      throw new AppError('Cannot remove owner', 403);
    }

    await prisma.organizationMember.update({
      where: { id: memberId },
      data: { isActive: false }
    });

    res.json({ success: true, message: 'Member removed' });
  } catch (error) {
    next(error);
  }
};

// Atualizar role do membro
export const updateMemberRole = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = (req as any).tenant?.id;
    const { memberId } = req.params;
    const { role } = req.body;

    const member = await prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId,
      },
      select: { id: true },
    });

    if (!member) {
      throw new AppError('Member not found', 404);
    }

    const updatedMember = await prisma.organizationMember.update({
      where: {
        id: memberId,
      },
      data: { role }
    });

    res.json({ success: true, member: updatedMember });
  } catch (error) {
    next(error);
  }
};
