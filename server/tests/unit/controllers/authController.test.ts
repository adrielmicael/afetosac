import { Request, Response, NextFunction } from 'express';
import { login, me, changePassword } from '../../src/controllers/authController';
import { prismaMock } from '../setup';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

// Mock jwt
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn(),
}));

describe('AuthController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      body: {},
      user: undefined,
    };
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('POST /login', () => {
    it('deve fazer login com credenciais válidas', async () => {
      const user = {
        id: '1',
        email: 'admin@afeto.com',
        name: 'Admin',
        password: 'hashed-password',
        role: 'ADMIN',
        avatar: null,
        isActive: true,
      };

      req.body = { email: 'admin@afeto.com', password: 'admin123' };

      prismaMock.user.findUnique.mockResolvedValue(user as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await login(req as Request, res as Response, next);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@afeto.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('admin123', 'hashed-password');
      expect(jwt.sign).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'mock-token',
        user: expect.objectContaining({
          id: '1',
          email: 'admin@afeto.com',
          name: 'Admin',
          role: 'ADMIN',
        }),
      });
    });

    it('deve retornar erro com email inválido', async () => {
      req.body = { email: 'invalid@email.com', password: 'password' };

      prismaMock.user.findUnique.mockResolvedValue(null);

      await login(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Invalid credentials',
        })
      );
    });

    it('deve retornar erro com senha incorreta', async () => {
      const user = {
        id: '1',
        email: 'admin@afeto.com',
        password: 'hashed-password',
        isActive: true,
      };

      req.body = { email: 'admin@afeto.com', password: 'wrongpassword' };

      prismaMock.user.findUnique.mockResolvedValue(user as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await login(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Invalid credentials',
        })
      );
    });

    it('deve retornar erro se usuário está inativo', async () => {
      const user = {
        id: '1',
        email: 'admin@afeto.com',
        password: 'hashed-password',
        isActive: false,
      };

      req.body = { email: 'admin@afeto.com', password: 'admin123' };

      prismaMock.user.findUnique.mockResolvedValue(user as any);

      await login(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Invalid credentials',
        })
      );
    });
  });

  describe('GET /me', () => {
    it('deve retornar dados do usuário autenticado', async () => {
      const user = {
        id: '1',
        email: 'admin@afeto.com',
        name: 'Admin',
        role: 'ADMIN',
        avatar: null,
        createdAt: new Date(),
      };

      req.user = { id: '1', email: 'admin@afeto.com', name: 'Admin', role: 'ADMIN' };

      prismaMock.user.findUnique.mockResolvedValue(user as any);

      await me(req as Request, res as Response, next);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        select: expect.any(Object),
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: expect.any(Object),
      });
    });

    it('deve retornar erro se usuário não está autenticado', async () => {
      req.user = undefined;

      await me(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Not authenticated',
        })
      );
    });
  });

  describe('POST /change-password', () => {
    it('deve alterar a senha com sucesso', async () => {
      const user = {
        id: '1',
        email: 'admin@afeto.com',
        password: 'old-hashed-password',
      };

      req.user = { id: '1', email: 'admin@afeto.com', name: 'Admin', role: 'ADMIN' };
      req.body = { currentPassword: 'oldpassword', newPassword: 'newpassword' };

      prismaMock.user.findUnique.mockResolvedValue(user as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      prismaMock.user.update.mockResolvedValue({ ...user, password: 'new-hashed-password' } as any);

      await changePassword(req as Request, res as Response, next);

      expect(bcrypt.compare).toHaveBeenCalledWith('oldpassword', 'old-hashed-password');
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 10);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { password: 'new-hashed-password' },
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully',
      });
    });

    it('deve retornar erro se senha atual está incorreta', async () => {
      const user = {
        id: '1',
        email: 'admin@afeto.com',
        password: 'hashed-password',
      };

      req.user = { id: '1', email: 'admin@afeto.com', name: 'Admin', role: 'ADMIN' };
      req.body = { currentPassword: 'wrongpassword', newPassword: 'newpassword' };

      prismaMock.user.findUnique.mockResolvedValue(user as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await changePassword(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: 'Current password is incorrect',
        })
      );
    });
  });
});
