import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Tipos de ações auditáveis
type AuditAction = 
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'PATIENT_VIEW'
  | 'PATIENT_CREATE'
  | 'PATIENT_UPDATE'
  | 'PATIENT_DELETE'
  | 'PATIENT_EXPORT'
  | 'PATIENT_ANONYMIZE'
  | 'CHAT_VIEW'
  | 'CHAT_ASSIGN'
  | 'CHAT_TRANSFER'
  | 'CHAT_CLOSE'
  | 'MESSAGE_SEND'
  | 'MESSAGE_DELETE'
  | 'SETTINGS_UPDATE'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET'
  | 'API_KEY_GENERATE'
  | 'REPORT_EXPORT';

// Campos sensíveis que devem ser ofuscados
const sensitiveFields = ['password', 'token', 'secret', 'authorization', 'cookie'];

// Função para sanitizar o body
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '***REDACTED***';
    }
  }
  return sanitized;
}

// Middleware de auditoria
export const auditLogger = (action: AuditAction, options?: {
  logBody?: boolean;
  logParams?: boolean;
  description?: string;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Capturar o status code original
    const originalSend = res.send.bind(res);
    res.send = function(body: any) {
      // Restaurar função original
      res.send = originalSend;
      
      // Calcular tempo de resposta
      const responseTime = Date.now() - startTime;
      
      // Criar log de auditoria
      const auditLog = {
        type: 'AUDIT',
        action,
        timestamp: new Date().toISOString(),
        user: {
          id: req.user?.id || 'anonymous',
          email: req.user?.email || 'anonymous',
          role: req.user?.role || 'none'
        },
        request: {
          method: req.method,
          path: req.path,
          params: options?.logParams ? req.params : undefined,
          query: Object.keys(req.query).length > 0 ? req.query : undefined,
          body: options?.logBody ? sanitizeBody(req.body) : undefined,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        },
        response: {
          statusCode: res.statusCode,
          responseTime: `${responseTime}ms`
        },
        description: options?.description || action,
        success: res.statusCode < 400
      };
      
      // Logar apenas se for importante ou se falhou
      if (!auditLog.success || ['USER_LOGIN', 'USER_DELETE', 'PATIENT_EXPORT', 'PATIENT_ANONYMIZE'].includes(action)) {
        logger.info('Audit Log', auditLog);
      }
      
      return originalSend(body);
    };
    
    next();
  };
};

// Middleware específico para login
export const auditLogin = (success: boolean, user?: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    logger.info({
      type: 'AUDIT',
      action: success ? 'USER_LOGIN_SUCCESS' : 'USER_LOGIN_FAILED',
      timestamp: new Date().toISOString(),
      user: user ? { id: user.id, email: user.email } : { email: req.body?.email },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      success
    });
    next();
  };
};

// Middleware para registrar acesso a dados sensíveis
export const auditDataAccess = (resource: string, resourceId: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    logger.info({
      type: 'DATA_ACCESS',
      resource,
      resourceId,
      userId: req.user?.id,
      timestamp: new Date().toISOString(),
      ip: req.ip
    });
    next();
  };
};
