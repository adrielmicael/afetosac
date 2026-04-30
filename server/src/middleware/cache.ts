import { Request, Response, NextFunction } from 'express';
import { cache, cacheKeys } from '../config/redis';
import { logger } from '../utils/logger';

interface CacheOptions {
  ttl: number; // segundos
  key?: string | ((req: Request) => string);
  condition?: (req: Request) => boolean;
}

/**
 * Middleware de cache para rotas de API
 * Cacheia a resposta no Redis
 */
export const cacheMiddleware = (options: CacheOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verificar condição
      if (options.condition && !options.condition(req)) {
        return next();
      }
      
      // Não cachear se houver header de cache-control: no-cache
      if (req.headers['cache-control'] === 'no-cache') {
        return next();
      }
      
      // Gerar chave de cache
      const tenantId = (req as any).tenant?.id || 'global';
      let cacheKey: string;
      
      if (typeof options.key === 'function') {
        cacheKey = `api:${tenantId}:${options.key(req)}`;
      } else if (typeof options.key === 'string') {
        cacheKey = `api:${tenantId}:${options.key}`;
      } else {
        // Chave padrão: método + path + query
        const queryString = Object.keys(req.query).length > 0 
          ? ':' + JSON.stringify(req.query) 
          : '';
        cacheKey = `api:${tenantId}:${req.method}:${req.path}${queryString}`;
      }
      
      // Tentar buscar do cache
      const cached = await cache.get(cacheKey);
      
      if (cached) {
        const data = JSON.parse(cached);
        res.setHeader('X-Cache', 'HIT');
        return res.json(data);
      }
      
      // Sobrescrever res.json para interceptar a resposta
      const originalJson = res.json.bind(res);
      
      res.json = (body: any) => {
        // Só cachear respostas de sucesso
        if (res.statusCode >= 200 && res.statusCode < 300 && body?.success) {
          cache.set(cacheKey, JSON.stringify(body), options.ttl).catch((err) => {
            logger.error('Cache set error:', err);
          });
        }
        
        res.setHeader('X-Cache', 'MISS');
        return originalJson(body);
      };
      
      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};

/**
 * Invalidar cache por padrão
 */
export const invalidateCache = async (pattern: string) => {
  try {
    await cache.delPattern(pattern);
    logger.debug(`Cache invalidated: ${pattern}`);
  } catch (error) {
    logger.error('Cache invalidation error:', error);
  }
};

/**
 * Middleware para invalidar cache após modificação
 */
export const clearCacheOnChange = (pattern: string | string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = (req as any).tenant?.id || 'global';
    
    // Sobrescrever res.json
    const originalJson = res.json.bind(res);
    
    res.json = (body: any) => {
      // Se operação foi bem-sucedida, invalidar cache
      if (body?.success) {
        const patterns = Array.isArray(pattern) ? pattern : [pattern];

        Promise.all(
          patterns.map((p) => {
            const fullPattern = p.includes('*')
              ? `api:${tenantId}:${p}`
              : `api:${tenantId}:${p}*`;
            return invalidateCache(fullPattern);
          })
        ).catch((err) => logger.error('Cache invalidation error:', err));
      }

      return originalJson(body);
    };
    
    next();
  };
};

// Configurações de cache pré-definidas
export const cacheConfigs = {
  // Dashboard: 5 minutos
  dashboard: {
    ttl: 5 * 60,
    key: (req: Request) => 'dashboard',
  },
  
  // Lista de chats: 30 segundos
  chats: {
    ttl: 30,
    key: (req: Request) => `chats:${JSON.stringify(req.query)}`,
  },
  
  // Lista de pacientes: 2 minutos
  patients: {
    ttl: 2 * 60,
    key: (req: Request) => `patients:${JSON.stringify(req.query)}`,
  },
  
  // Terapias, tags, templates: 10 minutos (raramente mudam)
  therapies: {
    ttl: 10 * 60,
    key: 'therapies',
  },
  
  tags: {
    ttl: 10 * 60,
    key: 'tags',
  },
  
  templates: {
    ttl: 10 * 60,
    key: 'templates',
  },
  
  // Configurações SLA: 10 minutos
  sla: {
    ttl: 10 * 60,
    key: 'sla:config',
  },
  
  // Relatórios: 1 hora (são pesados)
  reports: {
    ttl: 60 * 60,
    key: (req: Request) => `reports:${JSON.stringify(req.query)}`,
  },
};

export default cacheMiddleware;
