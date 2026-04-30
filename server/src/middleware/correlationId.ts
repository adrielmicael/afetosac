import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { runWithCorrelationId, setCorrelationId } from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Middleware de Correlation ID.
 * Propaga o header X-Correlation-ID vindo do cliente,
 * ou gera um novo UUID se ausente.
 * Inclui o ID na resposta para rastreabilidade ponta-a-ponta.
 */
export const correlationId = (req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.headers['x-correlation-id'];
  const id = (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();

  req.correlationId = id;
  res.setHeader('X-Correlation-ID', id);

  runWithCorrelationId(id, () => {
    setCorrelationId(id);
    // Limpar fallback ao finalizar a resposta
    res.on('finish', () => setCorrelationId(undefined));
    next();
  });
};
