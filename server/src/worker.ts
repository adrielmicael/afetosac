/**
 * Worker Process - Processamento de filas BullMQ
 * Este arquivo é o entrypoint para os workers em produção
 */

import './config/queues';
import { logger } from './utils/logger';

logger.info('🚀 Worker started');
logger.info('📦 Processing queues: whatsapp, email, media, reports, webhooks, events');

// Keep alive
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
