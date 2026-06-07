import request from 'supertest';
import express from 'express';
import authRoutes from '../../../src/routes/auth';
import { errorHandler } from '../../../src/middleware/errorHandler';
import { prismaMock } from '../../setup';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mocks
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(errorHandler);

describe('Auth Routes - Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('deve retornar token e usuário no login bem-sucedido', async () => {
      const mockUser = {
        id: '1',
        email: 'admin@afeto.com',
        name: 'Admin',
        password: 'hashed',
        avatar: null,
        isActive: true,
        twoFactorEnabled: false,
      };

      prismaMock.user.findUnique.mockResolvedValue(mockUser as any);
      prismaMock.organizationMember.findFirst.mockResolvedValue({
        role: 'ADMIN',
        organizationId: 'org1',
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('valid-jwt-token');

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@afeto.com', password: 'admin123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBe('valid-jwt-token');
      expect(response.body.user).toHaveProperty('id', '1');
    });

    it('deve retornar 401 para credenciais inválidas', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid@test.com', password: 'wrong' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('deve retornar 400 para dados incompletos', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@test.com' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('deve retornar dados do usuário com token válido', async () => {
      const mockUser = {
        id: '1',
        email: 'admin@afeto.com',
        name: 'Admin',
        role: 'ADMIN',
        avatar: null,
        createdAt: new Date(),
      };

      (jwt.verify as jest.Mock).mockReturnValue({
        id: '1',
        email: 'admin@afeto.com',
        name: 'Admin',
        role: 'ADMIN',
        organizationId: 'org1',
        jti: 'jti1',
      });
      // sessão válida (não revogada)
      prismaMock.deviceSession.findUnique.mockResolvedValue({
        id: 's1',
        isValid: true,
        expiresAt: new Date(Date.now() + 60_000),
      } as any);
      prismaMock.deviceSession.update.mockResolvedValue({} as any);
      prismaMock.organizationMember.findFirst.mockResolvedValue({
        role: 'ADMIN',
        organizationId: 'org1',
      } as any);
      prismaMock.user.findUnique.mockResolvedValue(mockUser as any);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toHaveProperty('email', 'admin@afeto.com');
    });

    it('deve retornar 401 sem token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });
  });
});
