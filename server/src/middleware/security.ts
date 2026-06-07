import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Forçar HTTPS em produção
export const forceHttps = (req: Request, res: Response, next: NextFunction) => {
  // Verificar se está em produção
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }
  
  // Verificar se já é HTTPS
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    return next();
  }
  
  // Health checks e /metrics nunca devem ser redirecionados —
  // probes do K8s e scraping do Prometheus batem via HTTP interno.
  if (req.path === '/health' || req.path.startsWith('/health/') || req.path === '/metrics') {
    return next();
  }
  
  // Redirecionar para HTTPS
  logger.info(`Redirecting HTTP to HTTPS: ${req.url}`);
  return res.redirect(301, `https://${req.headers.host}${req.url}`);
};

// Security headers adicionais
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Prevenir clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevenir MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Habilitar proteção XSS (legado, mas ainda útil)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 
    'camera=(), microphone=(), geolocation=(self), interest-cohort=()'
  );
  
  // Remove informações do servidor
  res.removeHeader('X-Powered-By');
  
  next();
};

// Verificar origem da requisição
export const verifyOrigin = (allowedOrigins: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin || req.headers.referer;
    
    // Permitir requisições sem origin (mobile apps, etc)
    if (!origin) {
      return next();
    }
    
    // Verificar se origin está na lista permitida
    const isAllowed = allowedOrigins.some(allowed => 
      origin.startsWith(allowed)
    );
    
    if (!isAllowed && process.env.NODE_ENV === 'production') {
      logger.warn(`Blocked request from unauthorized origin: ${origin}`);
      return res.status(403).json({
        success: false,
        error: 'Origin not allowed'
      });
    }
    
    next();
  };
};
