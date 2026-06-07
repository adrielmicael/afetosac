import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { hashPassword } from '../utils/password';
import { assertCanAddUser } from '../services/planLimitService';

const getOrganizationId = (req: Request): string => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AppError('Organization context required', 400);
  }
  return organizationId;
};

export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);

    const members = await prisma.organizationMember.findMany({
      where: { organizationId, isActive: true, user: { isActive: true } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            createdAt: true,
          },
        },
      },
    });

    const users = await Promise.all(
      members.map(async (member) => {
        const assignedChats = await prisma.chat.count({
          where: {
            organizationId,
            agentId: member.userId,
            status: { in: ['WAITING', 'IN_PROGRESS'] },
          },
        });

        return {
          ...member.user,
          role: member.role,
          _count: { assignedChats },
        };
      })
    );

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const member = await prisma.organizationMember.findFirst({
      where: { organizationId, userId: id, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            createdAt: true,
          },
        },
      },
    });

    if (!member) {
      throw new AppError('User not found', 404);
    }

    const assignedChats = await prisma.chat.findMany({
      where: {
        organizationId,
        agentId: id,
        status: { in: ['WAITING', 'IN_PROGRESS'] },
      },
      select: { id: true, name: true, status: true },
    });

    const user = {
      ...member.user,
      role: member.role,
      assignedChats,
    };

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);
    const { name, email, password, role } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new AppError('Email already registered', 400);
    }

    // Enforcement de plano: respeita o limite de usuários
    await assertCanAddUser(organizationId);

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
      },
    });

    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: user.id,
        role: role || 'AGENT',
      },
    });

    logger.info(`User created: ${user.email}`);

    res.status(201).json({
      success: true,
      user: {
        ...user,
        role: role || 'AGENT',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);
    const { id } = req.params;
    const { name, email, role, isActive, avatar } = req.body;

    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: id,
      },
      select: { id: true },
    });

    if (!member) {
      throw new AppError('User not found in this organization', 404);
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        isActive,
        avatar,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        isActive: true,
      },
    });

    if (role) {
      await prisma.organizationMember.updateMany({
        where: { organizationId, userId: id },
        data: { role },
      });
    }

    logger.info(`User updated: ${user.email}`);

    res.json({
      success: true,
      user: {
        ...user,
        role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);
    const { id } = req.params;

    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: id,
      },
      select: { id: true },
    });

    if (!member) {
      throw new AppError('User not found in this organization', 404);
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info(`User deactivated: ${id}`);

    res.json({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const inviteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);
    const { name, email, role } = req.body;

    if (!name || !email) {
      throw new AppError('Name and email are required', 400);
    }

    // Verifica se já existe usuário com esse email
    let user = await prisma.user.findUnique({ where: { email } });

    // Senha temporária aleatória
    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
    const hashedPassword = await hashPassword(tempPassword);

    // Verifica se já é membro
    const existingMember = user
      ? await prisma.organizationMember.findFirst({
          where: { organizationId, userId: user.id },
        })
      : null;

    if (existingMember?.isActive) {
      throw new AppError('User is already a member of this organization', 400);
    }

    // Enforcement de plano: novo membro ativo conta para o limite
    await assertCanAddUser(organizationId);

    if (!user) {
      user = await prisma.user.create({
        data: { name, email, password: hashedPassword },
      });
    }

    if (existingMember) {
      await prisma.organizationMember.update({
        where: { id: existingMember.id },
        data: { isActive: true, role: role || 'AGENT' },
      });
    } else {
      await prisma.organizationMember.create({
        data: { organizationId, userId: user.id, role: role || 'AGENT' },
      });
    }

    logger.info(`User invited: ${email} to org ${organizationId}`);

    res.status(201).json({
      success: true,
      message: `Usuário ${email} adicionado com sucesso.`,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: role || 'AGENT',
        tempPassword,
      },
    });
  } catch (error) {
    next(error);
  }
};
