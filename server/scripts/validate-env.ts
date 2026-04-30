import dotenv from 'dotenv';

dotenv.config();

const commonRequired = ['DATABASE_URL', 'JWT_SECRET'];
const productionRequired = [
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
];

const environment = process.env.NODE_ENV || 'development';
const required = environment === 'production'
  ? [...commonRequired, ...productionRequired]
  : commonRequired;

const missing = required.filter((key) => !process.env[key] || process.env[key]?.trim() === '');

if (missing.length > 0) {
  console.error(`[ENV] Missing required variables for ${environment}: ${missing.join(', ')}`);
  process.exit(1);
}

console.log(`[ENV] OK for ${environment}`);
