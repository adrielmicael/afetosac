/**
 * Netlify Function - Main API
 * Reutiliza o MESMO bootstrap do servidor stateful (createApp) para garantir
 * paridade de segurança: helmet, forceHttps, mongoSanitize, cookie-parser,
 * rate limiting e todas as rotas são idênticos.
 *
 * Limitação conhecida: Socket.io (tempo real) e rate limiting persistente NÃO
 * funcionam em ambiente serverless efêmero. Para realtime/limites distribuídos,
 * use o backend stateful (Docker/K8s) — ver netlify.toml e k8s/.
 */

import { Handler } from '@netlify/functions';
import express from 'express';
import serverless from 'serverless-http';

import { createApp } from '../../server/src/app';
import { validateEnvironment } from '../../server/src/config/env';

// Falha cedo se variáveis críticas estiverem ausentes (paridade com index.ts)
validateEnvironment();

const inner = createApp();

// Stub de Socket.io: serverless não mantém conexões persistentes.
// Evita que controllers que chamam req.app.get('io') quebrem.
const noopIo = {
  to: () => ({ emit: () => undefined }),
  emit: () => undefined,
};
inner.set('io', noopIo);

// O redirect do Netlify entrega o path SEM o prefixo /api (vem do :splat).
// Reescrevemos para casar com as rotas montadas em /api/* no createApp.
const app = express();
app.use((req, _res, next) => {
  if (!req.url.startsWith('/api')) {
    req.url = '/api' + (req.url === '/' ? '' : req.url);
  }
  next();
});
app.use(inner);

export const handler: Handler = serverless(app);
