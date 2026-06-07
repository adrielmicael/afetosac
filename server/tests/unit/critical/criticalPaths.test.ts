import { Request, Response, NextFunction } from 'express';
import { getChatById } from '../../../src/controllers/chatController';
import { sendMessage } from '../../../src/controllers/messageController';
import { assertCanAddUser } from '../../../src/services/planLimitService';
import { prismaMock } from '../../setup';

describe('Caminhos críticos', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      query: {},
      headers: {},
      user: { id: 'u1', email: 'a@b.com', name: 'A', role: 'AGENT', organizationId: 'orgA' },
    };
    res = { json: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  describe('Isolamento de tenant', () => {
    it('getChatById não acessa chat de outra org (404)', async () => {
      req.params = { id: 'chat-de-orgB' };
      // findFirst com {id, organizationId:'orgA'} não encontra -> null
      prismaMock.chat.findFirst.mockResolvedValue(null);

      await getChatById(req as Request, res as Response, next);

      expect(prismaMock.chat.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: 'orgA' }) })
      );
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });

    it('sendMessage rejeita chat fora da org (404)', async () => {
      req.params = { chatId: 'chat-de-orgB' };
      req.body = { content: 'oi' };
      prismaMock.chat.findFirst.mockResolvedValue(null);

      await sendMessage(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe('Política de janela 24h', () => {
    it('bloqueia mensagem livre fora da janela sem template (400)', async () => {
      req.params = { chatId: 'c1' };
      req.body = { content: 'mensagem fora da janela', type: 'TEXT' };
      prismaMock.chat.findFirst.mockResolvedValue({
        id: 'c1',
        organizationId: 'orgA',
        phone: '5511999',
        channel: 'WHATSAPP',
        is24hOpen: false,
        windowExpires: new Date(Date.now() - 60_000), // expirada
      } as any);

      await sendMessage(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: expect.stringContaining('JANELA_24H_FECHADA'),
        })
      );
    });
  });

  describe('Enforcement de plano (maxUsers)', () => {
    it('bloqueia quando o limite é atingido (403)', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({ maxUsers: 3 } as any);
      prismaMock.organizationMember.count.mockResolvedValue(3);

      await expect(assertCanAddUser('orgA')).rejects.toMatchObject({ statusCode: 403 });
    });

    it('permite quando há vaga', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({ maxUsers: 10 } as any);
      prismaMock.organizationMember.count.mockResolvedValue(2);

      await expect(assertCanAddUser('orgA')).resolves.toBeUndefined();
    });

    it('plano ilimitado (-1) nunca bloqueia', async () => {
      prismaMock.organization.findUnique.mockResolvedValue({ maxUsers: -1 } as any);

      await expect(assertCanAddUser('orgA')).resolves.toBeUndefined();
      expect(prismaMock.organizationMember.count).not.toHaveBeenCalled();
    });
  });
});
