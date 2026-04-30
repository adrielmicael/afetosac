import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';

const correlationStore = new AsyncLocalStorage<{ correlationId?: string }>();
let _fallbackCorrelationId: string | undefined;

export const setCorrelationId = (id: string | undefined) => {
  _fallbackCorrelationId = id;
  const store = correlationStore.getStore();
  if (store) {
    store.correlationId = id;
  }
};

export const getCorrelationId = () => {
  const store = correlationStore.getStore();
  return store?.correlationId ?? _fallbackCorrelationId;
};

export const runWithCorrelationId = (id: string, fn: () => void) => {
  correlationStore.run({ correlationId: id }, fn);
};

const isServerlessRuntime = Boolean(
  process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

// Netlify/AWS Lambda possuem filesystem efemero/restrito para escrita.
// Mantemos apenas console nesses ambientes para evitar falhas no bootstrap.
if (!isServerlessRuntime) {
  transports.push(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  );
}

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf((info) => {
      const base: any = {
        timestamp: info.timestamp,
        level: info.level,
        message: info.message,
      };
      const correlationId = getCorrelationId();
      if (correlationId) base.correlationId = correlationId;
      // Incluir campos extras (objetos logados diretamente)
      const { timestamp: _t, level: _l, message: _m, ...rest } = info;
      return JSON.stringify({ ...base, ...rest });
    })
  ),
  transports,
});
