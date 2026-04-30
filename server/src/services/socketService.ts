import { Server } from 'socket.io';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export const setupSocketHandlers = (io: Server) => {
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Join chat room
    socket.on('chat:join', (chatId: string) => {
      socket.join(`chat:${chatId}`);
      logger.debug(`Socket ${socket.id} joined chat ${chatId}`);
    });

    // Leave chat room
    socket.on('chat:leave', (chatId: string) => {
      socket.leave(`chat:${chatId}`);
      logger.debug(`Socket ${socket.id} left chat ${chatId}`);
    });

    // Typing indicator
    socket.on('typing:start', async (data: { chatId: string; userId: string }) => {
      socket.to(`chat:${data.chatId}`).emit('typing:start', {
        chatId: data.chatId,
        userId: data.userId,
      });
    });

    socket.on('typing:stop', async (data: { chatId: string; userId: string }) => {
      socket.to(`chat:${data.chatId}`).emit('typing:stop', {
        chatId: data.chatId,
        userId: data.userId,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });
};
