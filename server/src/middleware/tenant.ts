import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from './errorHandler';

// Extensão do Request para incluir tenant
interface TenantRequest extends Request {
  tenant?: {
    id: string;
    slug: string;
    plan: string;
  };
}

/**
 * Middleware para extrair e validar o tenant
 * Suporta: header X-Organization-ID ou subdomínio
 */
export const extractTenant = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Método 1: Header X-Organization-ID
    let organizationId = req.headers['x-organization-id'] as string;

    // Método 1.1: organização presente no JWT
    if (!organizationId && req.user?.organizationId) {
      organizationId = req.user.organizationId;
    }
    
    // Método 2: Subdomínio (clinica.afeto.com)
    if (!organizationId && req.headers.host) {
      const host = req.headers.host;
      const subdomain = host.split('.')[0];
      if (subdomain && subdomain !== 'www' && subdomain !== 'localhost' && subdomain !== '127') {
        const org = await prisma.organization.findUnique({
          where: { slug: subdomain },
          select: { id: true, slug: true, plan: true, status: true }
        });
        if (org) {
          organizationId = org.id;
        }
      }
    }

    if (!organizationId) {
      throw new AppError('Organization ID required', 400);
    }

    // Buscar organização
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, slug: true, plan: true, status: true }
    });

    if (!organization) {
      throw new AppError('Organization not found', 404);
    }

    if (organization.status !== 'ACTIVE') {
      throw new AppError('Organization is not active', 403);
    }

    // Adicionar tenant ao request
    req.tenant = {
      id: organization.id,
      slug: organization.slug,
      plan: organization.plan
    };

    // Se usuário está autenticado, verificar membership
    if (req.user) {
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId: organization.id,
          userId: req.user.id,
          isActive: true
        },
        select: { role: true, organizationId: true }
      });

      if (!membership) {
        throw new AppError('You do not have access to this organization', 403);
      }

      req.user.membership = membership;
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware para verificar permissões de role
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.membership?.role;
    
    if (!userRole) {
      return next(new AppError('Access denied', 403));
    }

    if (!allowedRoles.includes(userRole)) {
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
};

/**
 * Middleware para verificar plano da organização
 */
export const requirePlan = (...allowedPlans: string[]) => {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    const plan = req.tenant?.plan;
    
    if (!plan || !allowedPlans.includes(plan)) {
      return next(new AppError('This feature requires a higher plan', 403));
    }

    next();
  };
};

export default { extractTenant, requireRole, requirePlan };
