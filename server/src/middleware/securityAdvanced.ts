import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { logger } from '../utils/logger';
import { cache } from '../config/redis';

interface SecurityRequest extends Request {
  deviceInfo?: {
    name: string;
    type: string;
    ip: string;
    userAgent: string;
  };
}

/**
 * Detectar e bloquear ataques de força bruta
 */
export const bruteForceProtection = async (
  req: SecurityRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const ip = req.ip || 'unknown';
    const key = `bruteforce:login:${ip}`;
    
    // Contar tentativas nos últimos 15 minutos
    const attempts = await cache.get(key);
    const count = attempts ? parseInt(attempts) : 0;
    
    if (count >= 10) {
      logger.warn(`Brute force detected from IP: ${ip}`);
      return res.status(429).json({
        success: false,
        error: 'Too many failed attempts. Try again in 15 minutes.',
        code: 'BRUTE_FORCE_PROTECTION',
      });
    }
    
    // Incrementar contador
    await cache.set(key, String(count + 1), 900); // 15 minutos
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Registrar tentativa de login falha
 */
export const recordFailedLogin = async (ip: string, email?: string) => {
  const key = `bruteforce:login:${ip}`;
  const attempts = await cache.get(key);
  const count = attempts ? parseInt(attempts) : 0;
  await cache.set(key, String(count + 1), 900);
  
  logger.warn(`Failed login attempt from ${ip} for ${email || 'unknown'}`);
};

/**
 * Limpar tentativas após login bem-sucedido
 */
export const clearFailedLogins = async (ip: string) => {
  await cache.del(`bruteforce:login:${ip}`);
};

/**
 * Detectar login de novo dispositivo
 */
export const detectNewDevice = async (
  req: SecurityRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next();
    
    const ip = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    
    // Extrair info do dispositivo
    const deviceName = parseUserAgent(userAgent);
    const deviceType = detectDeviceType(userAgent);
    
    req.deviceInfo = {
      name: deviceName,
      type: deviceType,
      ip,
      userAgent,
    };
    
    // Verificar se é um dispositivo conhecido
    const knownDevice = await prisma.deviceSession.findFirst({
      where: {
        userId,
        userAgent: { contains: userAgent.substring(0, 50) },
        isValid: true,
      },
    });
    
    if (!knownDevice) {
      logger.info(`New device detected for user ${userId}: ${deviceName}`);
      // TODO: Enviar email de notificação
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Detectar acesso suspeito (horário/IP incomum)
 */
export const detectSuspiciousAccess = async (
  req: SecurityRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next();
    
    const ip = req.ip || 'unknown';
    const now = new Date();
    const hour = now.getHours();
    
    // Verificar horário incomum (fora 6h-23h)
    if (hour < 6 || hour > 23) {
      logger.warn(`Suspicious access time for user ${userId}: ${hour}h`);
    }
    
    // Verificar mudança de país (simplificado)
    // Em produção: usar geolocalização IP
    
    next();
  } catch (error) {
    next(error);
  }
};

// Helpers
function parseUserAgent(userAgent: string): string {
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  return 'Unknown Browser';
}

function detectDeviceType(userAgent: string): string {
  if (userAgent.includes('Mobile')) return 'mobile';
  if (userAgent.includes('Tablet')) return 'tablet';
  return 'desktop';
}

export default {
  bruteForceProtection,
  recordFailedLogin,
  clearFailedLogins,
  detectNewDevice,
  detectSuspiciousAccess,
};
