/**
 * Netlify Function - Main API
 * Adaptacao do Express para Serverless
 */

import { Handler } from '@netlify/functions';
import express from 'express';
import cors from 'cors';
import serverless from 'serverless-http';

// Rotas
import authRoutes from '../../server/src/routes/auth';
import chatRoutes from '../../server/src/routes/chats';
import messageRoutes from '../../server/src/routes/messages';
import patientRoutes from '../../server/src/routes/patients';
import userRoutes from '../../server/src/routes/users';
import templateRoutes from '../../server/src/routes/templates';
import quickReplyRoutes from '../../server/src/routes/quickReplies';
import webhookRoutes from '../../server/src/routes/webhooks';
import dashboardRoutes from '../../server/src/routes/dashboard';
import settingsRoutes from '../../server/src/routes/settings';
import gdprRoutes from '../../server/src/routes/gdpr';
import window24hRoutes from '../../server/src/routes/window24h';
import uploadRoutes from '../../server/src/routes/upload';
import slaRoutes from '../../server/src/routes/sla';
import chatbotRoutes from '../../server/src/routes/chatbot';
import organizationRoutes from '../../server/src/routes/organizations';
import twoFactorRoutes from '../../server/src/routes/twoFactor';
import billingRoutes from '../../server/src/routes/billing';
import kpiRoutes from '../../server/src/routes/kpis';
import apiKeyRoutes from '../../server/src/routes/apiKeys';
import webhookEndpointRoutes from '../../server/src/routes/webhookEndpoints';

// Middlewares de seguranca
import { globalLimiter, authLimiter } from '../../server/src/middleware/rateLimiter';
import { securityHeaders } from '../../server/src/middleware/security';
import { correlationId } from '../../server/src/middleware/correlationId';

const app = express();

const allowedOrigins = [
  ...(process.env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()) || []),
  process.env.URL,
  process.env.DEPLOY_PRIME_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter((origin): origin is string => Boolean(origin));

app.use(correlationId);
app.use(securityHeaders);
app.use(globalLimiter);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      if (req.originalUrl.includes('/webhooks/whatsapp')) {
        req.rawBody = buf.toString('utf8');
      }
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Netlify passa o path completo com o prefixo /api
app.use((req, _res, next) => {
  if (req.url.startsWith('/api')) {
    req.url = req.url.slice(4) || '/';
  }
  next();
});

app.use('/auth/login', authLimiter);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: 'netlify-functions',
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/chats', chatRoutes);
app.use('/messages', messageRoutes);
app.use('/patients', patientRoutes);
app.use('/users', userRoutes);
app.use('/templates', templateRoutes);
app.use('/quick-replies', quickReplyRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/settings', settingsRoutes);
app.use('/gdpr', gdprRoutes);
app.use('/window24h', window24hRoutes);
app.use('/upload', uploadRoutes);
app.use('/sla', slaRoutes);
app.use('/chatbot', chatbotRoutes);
app.use('/organizations', organizationRoutes);
app.use('/2fa', twoFactorRoutes);
app.use('/billing', billingRoutes);
app.use('/kpis', kpiRoutes);
app.use('/api-keys', apiKeyRoutes);
app.use('/webhook-endpoints', webhookEndpointRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

export const handler: Handler = serverless(app);
