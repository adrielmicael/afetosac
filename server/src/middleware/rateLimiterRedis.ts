import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

/**
 * Rate limiting distribuído usando Redis
 * Essencial para arquitetura multi-instância (SaaS)
 */
export const rateLimiterRedis = (config: RateLimitConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!redis) {
        return next();
      }

      // Identificador: IP + tenant (se existir)
      const tenantId = (req as any).tenant?.id || 'global';
      const identifier = req.ip || 'unknown';
      const key = `${config.keyPrefix || 'ratelimit'}:${tenantId}:${identifier}`;
      
      const now = Date.now();
      const windowStart = now - config.windowMs;
      
      // Usar Redis sorted set para sliding window
      // Remover entradas antigas
      await redis.zremrangebyscore(key, 0, windowStart);
      
      // Contar requisições no window atual
      const currentCount = await redis.zcard(key);
      
      if (currentCount >= config.maxRequests) {
        const ttl = await redis.ttl(key);
        res.setHeader('Retry-After', Math.ceil(ttl));
        return res.status(429).json({
          success: false,
          error: 'Too many requests, please try again later',
          retryAfter: ttl,
        });
      }
      
      // Adicionar requisição atual
      await redis.zadd(key, now, `${now}-${Math.random()}`);
      await redis.pexpire(key, config.windowMs);
      
      // Headers informativos
      res.setHeader('X-RateLimit-Limit', config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - currentCount - 1));
      
      next();
    } catch (error) {
      logger.error('Rate limiter error:', error);
      // Em caso de erro no Redis, permite a requisição (fail open)
      next();
    }
  };
};

// Configurações pré-definidas
export const rateLimitConfigs = {
  // API geral: 100 req/15min
  api: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
    keyPrefix: 'api',
  },
  
  // Auth: 5 tentativas/15min
  auth: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'auth',
  },
  
  // Upload: 10/min
  upload: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'upload',
  },
  
  // Webhooks: 1000/min por tenant
  webhook: {
    windowMs: 60 * 1000,
    maxRequests: 1000,
    keyPrefix: 'webhook',
  },
  
  // Por plano (exemplo)
  free: {
    windowMs: 60 * 1000,
    maxRequests: 30, // 30 req/min para plano free
    keyPrefix: 'plan:free',
  },
  
  pro: {
    windowMs: 60 * 1000,
    maxRequests: 300, // 300 req/min para plano pro
    keyPrefix: 'plan:pro',
  },
};

/**
 * Rate limiter por plano do tenant
 */
export const rateLimiterByPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!redis) {
      return next();
    }

    const tenant = (req as any).tenant;
    if (!tenant) {
      return next();
    }
    
    const plan = tenant.plan?.toLowerCase() || 'free';
    const config = rateLimitConfigs[plan as keyof typeof rateLimitConfigs] || rateLimitConfigs.free;
    
    const identifier = req.ip || 'unknown';
    const key = `${config.keyPrefix}:${tenant.id}:${identifier}`;
    
    const now = Date.now();
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.pexpire(key, config.windowMs);
    }
    
    if (current > config.maxRequests) {
      return res.status(429).json({
        success: false,
        error: `Rate limit exceeded for ${plan} plan. Upgrade for higher limits.`,
      });
    }
    
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - current));
    
    next();
  } catch (error) {
    logger.error('Plan rate limiter error:', error);
    next();
  }
};

export default rateLimiterRedis;
