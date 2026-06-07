import { Request, Response, NextFunction } from 'express';
import { platformLogin } from '../../../src/controllers/platformAuthController';
import { requirePlatformRole } from '../../../src/middleware/platformAuth';
import { prismaMock } from '../../setup';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

jest.mock('bcryptjs', () => ({ compare: jest.fn(), hash: jest.fn() }));
jest.mock('jsonwebtoken', () => ({ sign: jest.fn().mockReturnValue('mock-token'), verify: jest.fn() }));

describe('Platform auth', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { body: {}, headers: { 'user-agent': 'jest' } };
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('platformLogin', () => {
    it('emite sessão de plataforma quando sem 2FA', async () => {
      req.body = { email: 'ceo@afeto.com', password: 'StrongPass1' };
      prismaMock.platformAdmin.findUnique.mockResolvedValue({
        id: 'pa1',
        email: 'ceo@afeto.com',
        name: 'CEO',
        role: 'SUPERADMIN',
        password: 'hash',
        isActive: true,
        twoFactorEnabled: false,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await platformLogin(req as Request, res as Response, next);

      expect(prismaMock.platformSession.create).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith('platform_token', 'mock-token', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          token: 'mock-token',
          admin: expect.objectContaining({ id: 'pa1', role: 'SUPERADMIN' }),
        })
      );
    });

    it('exige 2FA quando habilitado, sem emitir sessão', async () => {
      req.body = { email: 'ceo@afeto.com', password: 'StrongPass1' };
      prismaMock.platformAdmin.findUnique.mockResolvedValue({
        id: 'pa1',
        email: 'ceo@afeto.com',
        name: 'CEO',
        role: 'SUPERADMIN',
        password: 'hash',
        isActive: true,
        twoFactorEnabled: true,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await platformLogin(req as Request, res as Response, next);

      expect(prismaMock.platformSession.create).not.toHaveBeenCalled();
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        requires2FA: true,
        challengeToken: 'mock-token',
      });
    });

    it('rejeita credenciais inválidas', async () => {
      req.body = { email: 'ceo@afeto.com', password: 'wrong' };
      prismaMock.platformAdmin.findUnique.mockResolvedValue({
        id: 'pa1', email: 'ceo@afeto.com', password: 'hash', isActive: true,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await platformLogin(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });
  });

  describe('requirePlatformRole', () => {
    const run = (role?: string, allowed: string[] = ['BILLING']) => {
      const r: any = role ? { platformAdmin: { role } } : {};
      const n = jest.fn();
      requirePlatformRole(...allowed)(r as Request, {} as Response, n);
      return n;
    };

    it('bloqueia sem autenticação de plataforma (401)', () => {
      expect(run(undefined)).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it('SUPERADMIN passa em qualquer rota', () => {
      expect(run('SUPERADMIN')).toHaveBeenCalledWith();
    });

    it('papel fora da lista é bloqueado (403)', () => {
      expect(run('READONLY', ['BILLING'])).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });

    it('papel na lista passa', () => {
      expect(run('BILLING', ['BILLING'])).toHaveBeenCalledWith();
    });
  });
});
