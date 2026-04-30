import request from 'supertest';
import express from 'express';
import chatRoutes from '../../src/routes/chats';
import { prismaMock } from '../setup';
import jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken');

const app = express();
app.use(express.json());

// Mock do middleware de autenticação
app.use((req, res, next) => {
  req.user = { id: '1', email: 'agent@test.com', name: 'Agent', role: 'AGENT' };
  next();
});

app.use('/api/chats', chatRoutes);

describe('Chat Routes - Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      const response = await request(app).get('/api/chats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.chats).toHaveLength(1);
    });

    it('deve filtrar por status', async () => {
      prismaMock.chat.findMany.mockResolvedValue([]);

      const response = await request(app).get('/api/chats?status=WAITING');

      expect(response.status).toBe(200);
      expect(prismaMock.chat.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'WAITING' }),
        })
      );
    });

    it('deve buscar por termo', async () => {
      prismaMock.chat.findMany.mockResolvedValue([]);

      const response = await request(app).get('/api/chats?search=João');

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

      prismaMock.chat.update.mockResolvedValue(mockChat as any);
      prismaMock.message.create.mockResolvedValue({} as any);

      const response = await request(app).post('/api/chats/1/assign');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(prismaMock.chat.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { agentId: '1', status: 'IN_PROGRESS' },
        include: expect.any(Object),
      });
    });

    it('deve retornar erro se chat não existe', async () => {
      prismaMock.chat.update.mockRejectedValue(new Error('Chat not found'));

      const response = await request(app).post('/api/chats/999/assign');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/chats/:id/close', () => {
    it('deve fechar o chat', async () => {
      const mockChat = {
        id: '1',
        status: 'CLOSED',
      };

      prismaMock.chat.update.mockResolvedValue(mockChat as any);
      prismaMock.message.create.mockResolvedValue({} as any);

      const response = await request(app).post('/api/chats/1/close');

      expect(response.status).toBe(200);
      expect(response.body.chat.status).toBe('CLOSED');
    });
  });
});
