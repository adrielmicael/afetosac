import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import path from 'path';

import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { correlationId } from './middleware/correlationId';
import prisma from './config/database';
import { redis } from './config/redis';

// Security middlewares
import {
  globalLimiter,
  authLimiter,
  webhookLimiter,
  messageLimiter,
} from './middleware/rateLimiter';
import { rateLimiterRedis, rateLimitConfigs } from './middleware/rateLimiterRedis';
import { securityHeaders, forceHttps } from './middleware/security';
import { metricsMiddleware, metricsHandler } from './middleware/metrics';

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
import gdprRoutes from './routes/gdpr';
import window24hRoutes from './routes/window24h';
import uploadRoutes from './routes/upload';
import slaRoutes from './routes/sla';
import chatbotRoutes from './routes/chatbot';
import organizationRoutes from './routes/organizations';
import twoFactorRoutes from './routes/twoFactor';
import billingRoutes from './routes/billing';
import kpiRoutes from './routes/kpis';
import apiKeyRoutes from './routes/apiKeys';
import webhookEndpointRoutes from './routes/webhookEndpoints';
import platformRoutes from './routes/platform';
import integrationRoutes from './routes/integrations';

/**
 * Constrói a aplicação Express completa com TODOS os middlewares de segurança
 * e rotas. Usado tanto pelo servidor stateful (index.ts, com Socket.io) quanto
 * pela função serverless (netlify) — garantindo PARIDADE de segurança.
 *
 * Não chama listen() nem cria o Socket.io: isso é responsabilidade do index.ts.
 */
export const createApp = (): express.Express => {
  const app = express();

  const allowedOrigins = [
    ...(process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) || []),
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    'http://localhost:5173',
    'http://localhost:3000',
  ].filter((o): o is string => Boolean(o));

  const useRedis = Boolean(redis);
  if (useRedis) {
    logger.info('Rate limiting: Redis distribuído (multi-instância)');
  } else {
    logger.info('Rate limiting: em memória (instância única)');
  }

  // 0. Correlation ID — primeiro
  app.use(correlationId);

  // 0.1 Métricas Prometheus (instrumenta todas as requisições)
  app.use(metricsMiddleware);

  // 1. Forçar HTTPS em produção
  app.use(forceHttps);

  // 2. Helmet — Security Headers + CSP
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          connectSrc: ["'self'", process.env.SUPABASE_URL || ''],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  // 3. Security headers adicionais
  app.use(securityHeaders);

  // 4. Sanitização de chaves perigosas
  app.use(
    mongoSanitize({
      replaceWith: '_',
      onSanitize: ({ req, key }) => {
        logger.warn(`Sanitized key: ${key} from IP: ${req.ip}`);
      },
    })
  );

  // 5. Cookie parsing (sessão httpOnly)
  app.use(cookieParser());

  // 6. Rate limiting global (Redis em produção multi-instância, senão memória)
  app.use(useRedis ? rateLimiterRedis(rateLimitConfigs.api) : globalLimiter);

  // 7. CORS estrito
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true); // mobile/curl/etc
        if (allowedOrigins.includes(origin)) return callback(null, true);
        logger.warn(`CORS blocked for origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Organization-ID'],
    })
  );

  // 8. Body parsing (preserva rawBody do webhook do WhatsApp p/ validar assinatura)
  app.use(
    express.json({
      limit: '10mb',
      verify: (req, _res, buf) => {
        const request = req as express.Request;
        // rawBody é necessário para validar assinaturas HMAC (webhook Meta + integração)
        if (
          request.originalUrl.includes('/webhooks/whatsapp') ||
          request.originalUrl.includes('/integrations/')
        ) {
          request.rawBody = buf.toString('utf8');
        }
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 9. Rate limiting específico por rota
  app.use('/api/auth/login', useRedis ? rateLimiterRedis(rateLimitConfigs.auth) : authLimiter);
  app.use('/api/auth/forgot-password', useRedis ? rateLimiterRedis(rateLimitConfigs.auth) : authLimiter);
  app.use('/api/webhooks', useRedis ? rateLimiterRedis(rateLimitConfigs.webhook) : webhookLimiter);
  app.use('/api/messages', messageLimiter);

  // 10. Arquivos estáticos (uploads)
  app.use(
    '/uploads',
    express.static(path.join(__dirname, '../uploads'), {
      maxAge: '1d',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    })
  );

  // ===== Health checks =====
  // Liveness: barato, não toca dependências
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  // Readiness: verifica dependências (DB obrigatório, Redis se configurado)
  app.get('/health/ready', async (_req, res) => {
    const checks: Record<string, string> = {};
    let healthy = true;

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
      healthy = false;
    }

    if (redis) {
      try {
        await redis.ping();
        checks.redis = 'ok';
      } catch {
        checks.redis = 'error';
        healthy = false;
      }
    } else {
      checks.redis = 'not_configured';
    }

    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ready' : 'degraded', checks });
  });

  // Métricas Prometheus (scraping)
  app.get('/metrics', metricsHandler);

  // ===== Routes =====
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
  app.use('/api/gdpr', gdprRoutes);
  app.use('/api/window24h', window24hRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/sla', slaRoutes);
  app.use('/api/chatbot', chatbotRoutes);
  app.use('/api/organizations', organizationRoutes);
  app.use('/api/2fa', twoFactorRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/kpis', kpiRoutes);
  app.use('/api/api-keys', apiKeyRoutes);
  app.use('/api/webhook-endpoints', webhookEndpointRoutes);
  app.use('/api/platform', platformRoutes); // SaaS super-admin (Lote 4)
  app.use('/api/integrations', integrationRoutes); // Afeto Clinic (Lote 7)

  // Handler específico para erros de CORS
  app.use((err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.message === 'Not allowed by CORS') {
      return res.status(403).json({ success: false, error: 'Acesso não autorizado' });
    }
    next(err);
  });

  // Handler de erros geral
  app.use(errorHandler);

  return app;
};

export default createApp;
