import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

/**
 * Observabilidade Prometheus. Expõe métricas default do Node + um histograma
 * de duração das requisições HTTP, rotuladas por método/rota/status/tenant.
 *
 * Nota de cardinalidade: usamos o PADRÃO da rota (ex.: /api/chats/:id), nunca
 * o path com IDs, para evitar explosão de séries.
 */
export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP em segundos',
  labelNames: ['method', 'route', 'status', 'tenant'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de requisições HTTP',
  labelNames: ['method', 'route', 'status', 'tenant'],
  registers: [registry],
});

const routeLabel = (req: Request): string => {
  const base = req.baseUrl || '';
  const path = (req.route as { path?: string } | undefined)?.path || '';
  const combined = `${base}${path}`;
  return combined || req.path || 'unmatched';
};

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Não instrumenta o próprio endpoint de scraping
  if (req.path === '/metrics') return next();

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    const labels = {
      method: req.method,
      route: routeLabel(req),
      status: String(res.statusCode),
      tenant: req.user?.organizationId || (req as any).tenant?.id || 'none',
    };
    httpRequestDuration.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels);
  });
  next();
};

export const metricsHandler = async (_req: Request, res: Response) => {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
};
