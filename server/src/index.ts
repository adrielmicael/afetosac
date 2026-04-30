import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';

import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { setupSocketHandlers } from './services/socketService';
import { validateEnvironment } from './config/env';
import { correlationId } from './middleware/correlationId';

// Security middlewares
import { 
  globalLimiter, 
  authLimiter, 
  webhookLimiter, 
  messageLimiter 
} from './middleware/rateLimiter';
import { securityHeaders, forceHttps } from './middleware/security';

// Routes
import authRoutes from './routes/auth';
import chatRoutes from './routes/chats';
import messageRoutes from './routes/messages';
import patientRoutes from './routes/patients';
import userRoutes from './routes/users';
import templateRoutes from './routes/templates';
import quickReplyRoutes from './routes/quickReplies';
import webhookRoutes from './routes/webhooks';
import dashboardRoutes from './routes/dashboard';
import settingsRoutes from './routes/settings';
import gdprRoutes from './routes/gdpr'; // LGPD/GDPR
import window24hRoutes from './routes/window24h'; // WhatsApp 24h Window
import uploadRoutes from './routes/upload'; // File Upload
import slaRoutes from './routes/sla'; // SLA Management
import chatbotRoutes from './routes/chatbot'; // Chatbot
import organizationRoutes from './routes/organizations'; // Multi-tenancy
import twoFactorRoutes from './routes/twoFactor'; // 2FA
import billingRoutes from './routes/billing'; // Stripe Billing
import kpiRoutes from './routes/kpis'; // KPIs parceiro Meta (Lote 5)

dotenv.config();
validateEnvironment();

const app = express();
const server = http.createServer(app);

// Configuração CORS estrita
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:3000'
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ==========================================
// 🔒 MIDDLEWARES DE SEGURANÇA (LOTE 1)
// ==========================================

// 0. Correlation ID — deve ser o primeiro
app.use(correlationId);

// 1. Forçar HTTPS em produção
app.use(forceHttps);

// 2. Helmet - Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", process.env.SUPABASE_URL || ''],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// 3. Security Headers adicionais
app.use(securityHeaders);

// 4. Sanitização NoSQL injection
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`Sanitized key: ${key} from IP: ${req.ip}`);
  }
}));

// 5. Rate Limiting Global
app.use(globalLimiter);

// 6. CORS configurado
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requisições sem origin (mobile, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    const request = req as express.Request;
    if (request.originalUrl.includes('/webhooks/whatsapp')) {
      request.rawBody = buf.toString('utf8');
    }
  },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==========================================
// 🔒 RATE LIMITING ESPECÍFICO POR ROTA
// ==========================================

// Auth endpoints - mais restritivo
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Webhooks - mais permissivo mas limitado
app.use('/api/webhooks', webhookLimiter);

// Mensagens - rate limiting específico
app.use('/api/messages', messageLimiter);

// ==========================================
// 📁 STATIC FILES
// ==========================================

app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '1d',
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// ==========================================
// 🚀 ROUTES
// ==========================================

app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/users', userRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/quick-replies', quickReplyRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/gdpr', gdprRoutes); // LGPD/GDPR routes
app.use('/api/window24h', window24hRoutes); // WhatsApp 24h Window routes
app.use('/api/upload', uploadRoutes); // File Upload routes
app.use('/api/sla', slaRoutes); // SLA Management routes
app.use('/api/chatbot', chatbotRoutes); // Chatbot routes
app.use('/api/organizations', organizationRoutes); // Multi-tenancy routes
app.use('/api/2fa', twoFactorRoutes); // 2FA routes
app.use('/api/billing', billingRoutes); // Stripe Billing routes
app.use('/api/kpis', kpiRoutes); // KPIs de qualidade — trilha parceiro Meta

// ==========================================
// 🏥 HEALTH CHECK
// ==========================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

// ==========================================
// ❌ ERROR HANDLING
// ==========================================

// Handler para erros CORS
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'Acesso não autorizado'
    });
  }
  next(err);
});

// Handler de erros geral
app.use(errorHandler);

// ==========================================
// 🔌 SOCKET.IO
// ==========================================

setupSocketHandlers(io);

// Make io accessible to routes
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
