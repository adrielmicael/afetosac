import { Request, Response, NextFunction } from 'express';
import {
  listOrganizations,
  updateOrganizationStatus,
  updateOrganizationPlan,
  impersonateOrganization,
} from '../../../src/controllers/platformController';
import { createOrganization } from '../../../src/controllers/organizationController';
import { prismaMock } from '../../setup';

jest.mock('jsonwebtoken', () => ({ sign: jest.fn().mockReturnValue('mock-token'), verify: jest.fn() }));
jest.mock('bcryptjs', () => ({ compare: jest.fn(), hash: jest.fn().mockResolvedValue('hash') }));

describe('Platform management', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      query: {},
      headers: { 'user-agent': 'jest' },
      platformAdmin: { id: 'pa1', email: 'admin@platform.com', role: 'SUPERADMIN', jti: 'j1' },
    };
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('lista organizações com paginação', async () => {
    prismaMock.organization.count.mockResolvedValue(1);
    prismaMock.organization.findMany.mockResolvedValue([
      { id: 'o1', name: 'Clínica A', slug: 'a', plan: 'PRO', status: 'ACTIVE', usageMetrics: [], _count: { members: 2, patients: 10 } },
    ] as any);

    await listOrganizations(req as Request, res as Response, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        pagination: expect.objectContaining({ page: 1, total: 1, pages: 1 }),
        data: expect.arrayContaining([expect.objectContaining({ id: 'o1', mrr: 149 })]),
      })
    );
  });

  it('altera status da organização e audita', async () => {
    req.params = { id: 'o1' };
    req.body = { status: 'SUSPENDED' };
    prismaMock.organization.findUnique.mockResolvedValue({ status: 'ACTIVE' } as any);
    prismaMock.organization.update.mockResolvedValue({ id: 'o1', name: 'A', status: 'SUSPENDED' } as any);

    await updateOrganizationStatus(req as Request, res as Response, next);

    expect(prismaMock.platformAuditLog.create).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, organization: expect.objectContaining({ status: 'SUSPENDED' }) })
    );
  });

  it('rejeita status inválido', async () => {
    req.params = { id: 'o1' };
    req.body = { status: 'FOO' };
    await updateOrganizationStatus(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('troca de plano aplica os limites do plano', async () => {
    req.params = { id: 'o1' };
    req.body = { plan: 'STARTER' };
    prismaMock.organization.findUnique.mockResolvedValue({ plan: 'FREE', maxUsers: 3, maxChats: 100, maxStorageGB: 1 } as any);
    prismaMock.organization.update.mockResolvedValue({ id: 'o1', plan: 'STARTER', maxUsers: 10, maxChats: 500, maxStorageGB: 5 } as any);

    await updateOrganizationPlan(req as Request, res as Response, next);

    expect(prismaMock.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plan: 'STARTER', maxUsers: 10, maxChats: 500, maxStorageGB: 5 }),
      })
    );
  });

  it('impersonação emite token de tenant e audita', async () => {
    req.params = { id: 'o1' };
    req.body = {};
    prismaMock.organization.findUnique.mockResolvedValue({ id: 'o1', status: 'ACTIVE' } as any);
    prismaMock.organizationMember.findFirst.mockResolvedValue({
      role: 'OWNER',
      organizationId: 'o1',
      user: { id: 'u1', email: 'owner@a.com', name: 'Owner' },
    } as any);

    await impersonateOrganization(req as Request, res as Response, next);

    expect(prismaMock.deviceSession.create).toHaveBeenCalled();
    expect(prismaMock.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'IMPERSONATE' }) })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, token: 'mock-token' })
    );
  });

  it('onboarding público bloqueado por padrão (403)', async () => {
    delete process.env.ALLOW_PUBLIC_SIGNUP;
    const pubReq: any = { body: { name: 'X', userEmail: 'a@b.com', userName: 'A', userPassword: 'StrongPass1' }, headers: {} };
    await createOrganization(pubReq, res as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});
