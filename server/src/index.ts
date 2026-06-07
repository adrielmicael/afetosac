import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import { createApp } from './app';
import { logger } from './utils/logger';
import { setupSocketHandlers } from './services/socketService';
import { validateEnvironment } from './config/env';

dotenv.config();
validateEnvironment();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) || [
  'http://localhost:5173',
  'http://localhost:3000',
];

// App Express completo (middlewares + rotas), compartilhado com a função serverless
const app = createApp();
const server = http.createServer(app);

// ==========================================
// 🔌 SOCKET.IO (somente no servidor stateful)
// ==========================================
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setupSocketHandlers(io);
app.set('io', io);

// ==========================================
// 🚀 START SERVER
// ==========================================
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔒 Security middlewares: ENABLED`);
});

export { io };
