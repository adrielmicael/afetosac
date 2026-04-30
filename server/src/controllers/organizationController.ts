import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { slugify } from '../utils/slugify';

// Criar nova organização (onboarding)
export const createOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, slug, userEmail, userName, userPassword } = req.body;

    // Validar slug
    const cleanSlug = slugify(slug || name);
    
    // Verificar se slug já existe
    const existing = await prisma.organization.findUnique({
      where: { slug: cleanSlug }
    });

    if (existing) {
      throw new AppError('Organization slug already exists', 400);
    }

    // Criar usuário admin
    const hashedPassword = await bcrypt.hash(userPassword, 10);
    const user = await prisma.user.create({
      data: {
        email: userEmail,
        name: userName,
        password: hashedPassword,
      }
    });

    // Criar organização
    const organization = await prisma.organization.create({
      data: {
        name,
        slug: cleanSlug,
        plan: 'FREE',
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          }
        }
      }
    });

    // Criar configurações SLA padrão
    await prisma.sLAConfig.create({
      data: {
        organizationId: organization.id,
        name: 'Padrão',
        firstResponseMinutes: 15,
        resolutionMinutes: 240,
        isDefault: true,
      }
    });

    logger.info(`Organization created: ${organization.name} (${organization.slug})`);

    // Gerar token
    const token = jwt.sign(
      { userId: user.id, organizationId: organization.id },
      process.env.JWT_SECRET!,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
    );

    res.status(201).json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        plan: organization.plan,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'OWNER',
      },
      token,
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

// Convidar membro
export const inviteMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = (req as any).tenant?.id;
    const { email, name, role } = req.body;

    // Verificar limite de usuários do plano
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { _count: { select: { members: true } } }
    });

    if (org && org._count.members >= org.maxUsers) {
      throw new AppError('User limit reached for this plan', 403);
    }

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

    // Criar usuário se não existir
    let user = existingUser;
    if (!user) {
      const tempPassword = Math.random().toString(36).slice(-8);
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          password: await bcrypt.hash(tempPassword, 10),
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
