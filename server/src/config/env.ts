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
  const productionRequired = [
    'WHATSAPP_APP_SECRET',
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
  ];

  const required = process.env.NODE_ENV === 'production'
    ? [...commonRequired, ...productionRequired]
    : commonRequired;

  const missing = getMissingEnv(required);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  logger.info(`Environment validated (${process.env.NODE_ENV || 'development'})`);
};
