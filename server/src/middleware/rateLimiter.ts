import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

// Rate limiter global - 100 requisições por 15 minutos
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite por IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    const resetTime = req.rateLimit.resetTime?.getTime() || Date.now();
    res.status(429).json({
      success: false,
      error: 'Muitas requisições. Tente novamente em 15 minutos.',
      retryAfter: Math.ceil(resetTime / 1000)
    });
  },
  skip: (req) => {
    // Skip para health checks e webhooks específicos
    return req.path === '/health' || req.path.startsWith('/api/webhooks');
  }
});

// Rate limiter para autenticação - 5 tentativas por 15 minutos
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // Não conta logins bem-sucedidos
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    const resetTime = req.rateLimit.resetTime?.getTime() || Date.now();
    res.status(429).json({
      success: false,
      error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
      retryAfter: Math.ceil(resetTime / 1000)
    });
  }
});

// Rate limiter específico para webhooks - mais permissivo
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 1000, // 1000 requisições por minuto
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.ip || 'unknown'
});

// Rate limiter para uploads - mais restritivo
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 uploads por minuto
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Limite de uploads atingido. Tente novamente em 1 minuto.'
    });
  }
});

// Rate limiter para API de mensagens
export const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60, // 1 mensagem por segundo em média
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: 'Muitas mensagens em pouco tempo. Aguarde um momento.'
    });
  }
});
