#!/usr/bin/env tsx
/**
 * Checklist de pré-go-live — Afeto SAC
 *
 * Verifica condições de produção antes de liberar tráfego real.
 * Sai com código 1 se qualquer item crítico estiver ausente.
 *
 * Uso:
 *   tsx scripts/precheck.ts
 */

type Severity = 'CRITICAL' | 'WARN' | 'INFO';

interface Item {
  name: string;
  ok: boolean;
  message?: string;
  severity: Severity;
}

const items: Item[] = [];

function check(severity: Severity, name: string, condition: boolean, failMessage?: string) {
  items.push({ name, ok: condition, message: condition ? undefined : failMessage, severity });
}

// ─── Variáveis de ambiente obrigatórias ─────────────────────────────────────

const env = (key: string) => process.env[key];
const hasEnv = (key: string) => !!env(key)?.trim();

const isProd = env('NODE_ENV') === 'production';

check('CRITICAL', 'NODE_ENV=production', isProd,
  `NODE_ENV atual: "${env('NODE_ENV') ?? 'não definido'}"`);

check('CRITICAL', 'DATABASE_URL configurado', hasEnv('DATABASE_URL'),
  'DATABASE_URL ausente — banco não conectará');

check('CRITICAL', 'JWT_SECRET configurado', hasEnv('JWT_SECRET'),
  'JWT_SECRET ausente — tokens inválidos');

check('CRITICAL', 'JWT_SECRET não é o padrão inseguro', env('JWT_SECRET') !== 'secret',
  'JWT_SECRET está com valor "secret" — risco crítico de segurança');

check('CRITICAL', 'WHATSAPP_ACCESS_TOKEN configurado', hasEnv('WHATSAPP_ACCESS_TOKEN'),
  'WHATSAPP_ACCESS_TOKEN ausente — envio de mensagens falhará');

check('CRITICAL', 'WHATSAPP_PHONE_NUMBER_ID configurado', hasEnv('WHATSAPP_PHONE_NUMBER_ID'),
  'WHATSAPP_PHONE_NUMBER_ID ausente — envio de mensagens falhará');

check('CRITICAL', 'WHATSAPP_APP_SECRET configurado', hasEnv('WHATSAPP_APP_SECRET'),
  'WHATSAPP_APP_SECRET ausente — webhook não será validado em produção');

check('WARN', 'REDIS_URL configurado (filas)', hasEnv('REDIS_URL'),
  'REDIS_URL ausente — filas usarão PostgreSQL como fallback');

check('WARN', 'STRIPE_SECRET_KEY configurado (cobrança)', hasEnv('STRIPE_SECRET_KEY'),
  'STRIPE_SECRET_KEY ausente — módulo de cobrança desabilitado');

check('WARN', 'ALLOWED_ORIGINS configurado', hasEnv('ALLOWED_ORIGINS'),
  'ALLOWED_ORIGINS ausente — CORS usando padrões de desenvolvimento');

check('INFO', 'SUPABASE_URL configurado', hasEnv('SUPABASE_URL'),
  'SUPABASE_URL ausente — funcionalidades Supabase desabilitadas');

// ─── Lote 2: LGPD ─────────────────────────────────────────────────────────

check('WARN', '[LGPD] SUPABASE_SERVICE_ROLE_KEY configurado', hasEnv('SUPABASE_SERVICE_ROLE_KEY'),
  'SUPABASE_SERVICE_ROLE_KEY ausente — exportação e anonimização LGPD indisponíveis');

// ─── Lote 3: Observabilidade ──────────────────────────────────────────────

check('INFO', '[Obs] WHATSAPP_APP_SECRET garante validação de webhook', hasEnv('WHATSAPP_APP_SECRET'),
  'Sem WHATSAPP_APP_SECRET payloads de webhook não são validados por HMAC (Lote 3)');

check('INFO', '[Obs] NODE_ENV=production ativa logs estruturados', isProd,
  'Em dev os logs não são estruturados — verifique se isso é intencional');

// ─── Segurança mínima ─────────────────────────────────────────────────────

const jwtSecret = env('JWT_SECRET') ?? '';
check('CRITICAL', 'JWT_SECRET tem ao menos 32 caracteres', jwtSecret.length >= 32,
  `JWT_SECRET tem ${jwtSecret.length} chars — use ao menos 32 chars aleatórios`);

const dbUrl = env('DATABASE_URL') ?? '';
check('WARN', 'DATABASE_URL usa SSL (sslmode=require)', dbUrl.includes('sslmode=require') || dbUrl.includes('ssl=true'),
  'DATABASE_URL sem SSL — recomendado para produção');

// ─── Trilha Parceiro Meta (Lote 5) ────────────────────────────────────────
// Evidências técnicas exigidas no processo de candidatura.

check('INFO', '[Meta Partner] WHATSAPP_BUSINESS_ACCOUNT_ID configurado',
  hasEnv('WHATSAPP_BUSINESS_ACCOUNT_ID'),
  'WHATSAPP_BUSINESS_ACCOUNT_ID ausente — necessário para candidatura parceiro Meta');

check('INFO', '[Meta Partner] WHATSAPP_APP_ID configurado',
  hasEnv('WHATSAPP_APP_ID'),
  'WHATSAPP_APP_ID ausente — necessário para candidatura parceiro Meta');

check('INFO', '[Meta Partner] META_PARTNER_ID configurado (opcional até candidatura)',
  hasEnv('META_PARTNER_ID'),
  'META_PARTNER_ID ausente — preencher ao formalizar candidatura no Meta Business Partner Hub');

check('WARN', '[Meta Partner] NODE_TLS_REJECT_UNAUTHORIZED não desabilitado',
  process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
  'NODE_TLS_REJECT_UNAUTHORIZED=0 desabilita verificação TLS — risco de segurança em produção');

// ─── Output ──────────────────────────────────────────────────────────────────

const criticalFailed = items.filter((i) => !i.ok && i.severity === 'CRITICAL');
const warnFailed = items.filter((i) => !i.ok && i.severity === 'WARN');
const passed = items.filter((i) => i.ok);

console.log('\n🔎 Checklist Pré-Go-Live — Afeto SAC\n');

for (const item of items) {
  const icon = item.ok ? '✅' : item.severity === 'CRITICAL' ? '❌' : item.severity === 'WARN' ? '⚠️ ' : 'ℹ️ ';
  const suffix = !item.ok && item.message ? `  → ${item.message}` : '';
  console.log(`  ${icon} ${item.name}${suffix}`);
}

console.log(`\n────────────────────────────────────────`);
console.log(`Passaram: ${passed.length}/${items.length}`);

if (criticalFailed.length > 0) {
  console.log(`\n❌ ${criticalFailed.length} item(ns) CRÍTICO(s) falharam — go-live BLOQUEADO\n`);
  process.exit(1);
}

if (warnFailed.length > 0) {
  console.log(`\n⚠️  ${warnFailed.length} aviso(s) — go-live permitido, mas revise antes de ir a público\n`);
  process.exit(0);
}

console.log('\n✅ Checklist OK — sistema pronto para go-live\n');
