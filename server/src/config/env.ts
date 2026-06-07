import { logger } from '../utils/logger';

const getMissingEnv = (keys: string[]): string[] => {
  return keys.filter((key) => !process.env[key] || process.env[key]?.trim() === '');
};

export const getJwtSecret = (): string => {
  const value = process.env.JWT_SECRET;
  if (!value || value.trim() === '') {
    throw new Error('JWT_SECRET is required');
  }
  return value;
};

export const validateEnvironment = (): void => {
  const commonRequired = ['DATABASE_URL', 'JWT_SECRET'];
  // Multi-tenant: as credenciais WhatsApp são por organização (no banco, cifradas).
  // O que precisa ser global em produção é a chave do cofre de criptografia.
  const productionRequired = ['ENCRYPTION_KEY'];

  const required = process.env.NODE_ENV === 'production'
    ? [...commonRequired, ...productionRequired]
    : commonRequired;

  const missing = getMissingEnv(required);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (process.env.NODE_ENV !== 'production' && !process.env.ENCRYPTION_KEY) {
    logger.warn('ENCRYPTION_KEY não configurada — operações de cifra de segredos falharão até configurá-la.');
  }

  logger.info(`Environment validated (${process.env.NODE_ENV || 'development'})`);
};
