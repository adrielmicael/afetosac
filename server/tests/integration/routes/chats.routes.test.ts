import request from 'supertest';
import express from 'express';
import chatRoutes from '../../../src/routes/chats';
import { errorHandler } from '../../../src/middleware/errorHandler';
import { prismaMock } from '../../setup';
import jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken');

const app = express();
app.use(express.json());
// Stub do Socket.io usado pelos controllers
app.set('io', { to: () => ({ emit: () => undefined }), emit: () => undefined });
app.use('/api/chats', chatRoutes);
app.use(errorHandler);

// Helper: monta uma requisição já autenticada (Bearer + tenant header)
const authed = (req: request.Test) =>
  req.set('Authorization', 'Bearer test-token').set('x-organization-id', 'org1');

describe('Chat Routes - Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Sessão autenticada válida (authenticate + extractTenant)
    (jwt.verify as jest.Mock).mockReturnValue({
      id: '1',
      email: 'agent@test.com',
      name: 'Agent',
      role: 'AGENT',
      organizationId: 'org1',
      jti: 'jti1',
    });
    prismaMock.deviceSession.findUnique.mockResolvedValue({
      id: 's1',
      isValid: true,
      expiresAt: new Date(Date.now() + 60_000),
    } as any);
    prismaMock.deviceSession.update.mockResolvedValue({} as any);
    prismaMock.organization.findUnique.mockResolvedValue({
      id: 'org1',
      slug: 'clinica',
      plan: 'PRO',
      status: 'ACTIVE',
    } as any);
    prismaMock.organizationMember.findFirst.mockResolvedValue({
      role: 'AGENT',
      organizationId: 'org1',
    } as any);
  });

  describe('GET /api/chats', () => {
    it('deve retornar lista de chats', async () => {
      const mockChats = [
        {
          id: '1',
          name: 'João',
          phone: '5511999999999',
          status: 'IN_PROGRESS',
          unreadCount: 2,
          lastMessageAt: new Date(),
          agent: { id: '1', name: 'Agent', avatar: null },
          patient: null,
          tags: [],
          _count: { messages: 10 },
        },
      ];

      prismaMock.chat.findMany.mockResolvedValue(mockChats as any);

      const response = await authed(request(app).get('/api/chats'));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.chats).toHaveLength(1);
    });

    it('deve filtrar por status', async () => {
      prismaMock.chat.findMany.mockResolvedValue([]);

      const response = await authed(request(app).get('/api/chats?status=WAITING'));

      expect(response.status).toBe(200);
      expect(prismaMock.chat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'WAITING' }),
        })
      );
    });

    it('deve buscar por termo', async () => {
      prismaMock.chat.findMany.mockResolvedValue([]);

      const response = await authed(request(app).get('/api/chats?search=João'));

      expect(response.status).toBe(200);
      expect(prismaMock.chat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('POST /api/chats/:id/assign', () => {
    it('deve atribuir chat ao agente', async () => {
      const mockChat = {
        id: '1',
        name: 'João',
        status: 'IN_PROGRESS',
        agentId: '1',
        agent: { id: '1', name: 'Agent', avatar: null },
        patient: null,
        tags: [],
      };

      prismaMock.chat.findFirst.mockResolvedValue({ id: '1', firstResponseAt: null } as any);
      prismaMock.chat.update.mockResolvedValue(mockChat as any);
      prismaMock.message.create.mockResolvedValue({} as any);

      const response = await authed(request(app).post('/api/chats/1/assign'));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(prismaMock.chat.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({ agentId: '1', status: 'IN_PROGRESS' }),
        include: expect.any(Object),
      });
    });

    it('deve retornar 404 se chat não existe', async () => {
      prismaMock.chat.findFirst.mockResolvedValue(null);

      const response = await authed(request(app).post('/api/chats/999/assign'));

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/chats/:id/close', () => {
    it('deve fechar o chat', async () => {
      const mockChat = {
        id: '1',
        status: 'CLOSED',
      };

      prismaMock.chat.findFirst.mockResolvedValue({ id: '1' } as any);
      prismaMock.chat.update.mockResolvedValue(mockChat as any);
      prismaMock.message.create.mockResolvedValue({} as any);

      const response = await authed(request(app).post('/api/chats/1/close'));

      expect(response.status).toBe(200);
      expect(response.body.chat.status).toBe('CLOSED');
    });
  });
});
