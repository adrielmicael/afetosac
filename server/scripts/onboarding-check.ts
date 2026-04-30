#!/usr/bin/env tsx
/**
 * Onboarding Check — Afeto SAC
 *
 * Valida se um novo tenant está corretamente configurado antes de liberar
 * acesso a pacientes reais. Roda manualmente após criar um novo tenant/clínica.
 *
 * Uso:
 *   BASE_URL=https://api.meusite.com \
 *   ONBOARDING_EMAIL=admin@clinica.com \
 *   ONBOARDING_PASSWORD=senhaDoAdmin \
 *   tsx scripts/onboarding-check.ts
 *
 * Variáveis de ambiente:
 *   BASE_URL              — URL base da API (obrigatório)
 *   ONBOARDING_EMAIL      — E-mail do admin do tenant (obrigatório)
 *   ONBOARDING_PASSWORD   — Senha do admin (obrigatório)
 *   ONBOARDING_TIMEOUT_MS — Timeout por request em ms (padrão: 10000)
 */

import https from 'https';
import http from 'http';

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = process.env.BASE_URL;
const EMAIL = process.env.ONBOARDING_EMAIL;
const PASSWORD = process.env.ONBOARDING_PASSWORD;
const TIMEOUT_MS = parseInt(process.env.ONBOARDING_TIMEOUT_MS || '10000', 10);

if (!BASE_URL || !EMAIL || !PASSWORD) {
  console.error('❌ Variáveis obrigatórias: BASE_URL, ONBOARDING_EMAIL, ONBOARDING_PASSWORD');
  process.exit(1);
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

interface ApiResponse {
  status: number;
  body: any;
}

async function request(
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const payload = body ? JSON.stringify(body) : undefined;

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout: TIMEOUT_MS,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed: any;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode ?? 0, body: parsed });
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout após ${TIMEOUT_MS}ms`)); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Check helpers ────────────────────────────────────────────────────────────

type Severity = 'ERROR' | 'WARN' | 'INFO';

interface CheckResult {
  name: string;
  ok: boolean;
  severity: Severity;
  message?: string;
}

const results: CheckResult[] = [];

function record(severity: Severity, name: string, ok: boolean, message?: string) {
  results.push({ name, ok, severity, message });
  const icon = ok ? '✅' : severity === 'ERROR' ? '❌' : severity === 'WARN' ? '⚠️ ' : 'ℹ️ ';
  console.log(`  ${icon} ${name}${!ok && message ? `  → ${message}` : ''}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runOnboardingCheck() {
  console.log('\n📋 Onboarding Check — Afeto SAC');
  console.log(`   Tenant: ${EMAIL} @ ${BASE_URL}\n`);

  // 1. Autenticação
  console.log('1. Autenticação');
  let token: string | undefined;
  let orgId: string | undefined;

  try {
    const r = await request('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
    const ok = r.status === 200 && !!r.body?.token;
    token = ok ? r.body.token : undefined;
    orgId = r.body?.user?.organizationId ?? r.body?.organizationId;
    record('ERROR', 'Login do admin do tenant', ok, ok ? undefined : `status=${r.status}`);
  } catch (err: any) {
    record('ERROR', 'Login do admin do tenant', false, err.message);
  }

  if (!token) {
    console.log('\n❌ Não foi possível autenticar — verificações seguintes canceladas.');
    process.exit(1);
  }

  // 2. Perfil e organização
  console.log('\n2. Organização');

  try {
    const r = await request('GET', '/api/auth/me', undefined, token);
    record('ERROR', 'Perfil do usuário acessível', r.status === 200,
      r.status !== 200 ? `status=${r.status}` : undefined);
    record('ERROR', 'Usuário pertence a uma organização',
      !!(r.body?.user?.organizationId ?? r.body?.organizationId),
      'organizationId ausente no perfil — tenant pode não ter sido criado corretamente');
  } catch (err: any) {
    record('ERROR', 'Perfil do usuário acessível', false, err.message);
  }

  try {
    const r = await request('GET', '/api/organizations/current', undefined, token);
    const orgOk = r.status === 200;
    record('ERROR', 'Dados da organização acessíveis', orgOk,
      !orgOk ? `status=${r.status}` : undefined);
    if (orgOk) {
      const whatsappConfigured = !!(r.body?.organization?.whatsappPhoneNumberId ?? r.body?.whatsappPhoneNumberId);
      record('WARN', 'WhatsApp Phone Number ID configurado na organização', whatsappConfigured,
        'Configurar em Settings → WhatsApp antes de receber/enviar mensagens');
      const webhookOk = !!(r.body?.organization?.webhookVerifyToken ?? r.body?.webhookVerifyToken);
      record('WARN', 'Webhook Verify Token configurado', webhookOk,
        'Necessário para validar webhook na Meta');
    }
  } catch (err: any) {
    record('ERROR', 'Dados da organização acessíveis', false, err.message);
  }

  // 3. Templates WhatsApp
  console.log('\n3. Templates');

  try {
    const r = await request('GET', '/api/templates', undefined, token);
    const ok = r.status === 200;
    record('WARN', 'Endpoint de templates acessível', ok,
      !ok ? `status=${r.status}` : undefined);
    if (ok) {
      const list: any[] = r.body?.templates ?? r.body ?? [];
      const hasTemplates = Array.isArray(list) && list.length > 0;
      record('WARN', `Ao menos 1 template cadastrado (encontrado: ${Array.isArray(list) ? list.length : 0})`,
        hasTemplates,
        'Cadastrar ao menos 1 template UTILITY aprovado para uso fora da janela de 24h');
    }
  } catch (err: any) {
    record('WARN', 'Endpoint de templates acessível', false, err.message);
  }

  // 4. Usuários e papéis
  console.log('\n4. Membros');

  try {
    const r = await request('GET', '/api/users', undefined, token);
    const ok = r.status === 200;
    record('INFO', 'Listagem de membros acessível', ok,
      !ok ? `status=${r.status}` : undefined);
    if (ok) {
      const users: any[] = r.body?.users ?? r.body ?? [];
      record('WARN', `Ao menos 1 agente cadastrado (encontrado: ${Array.isArray(users) ? users.length : 0})`,
        Array.isArray(users) && users.length > 0,
        'Cadastrar ao menos 1 agente para atendimento');
    }
  } catch (err: any) {
    record('INFO', 'Listagem de membros acessível', false, err.message);
  }

  // 5. Políticas de consentimento (LGPD)
  console.log('\n5. LGPD e Consentimento');

  try {
    const r = await request('GET', '/api/gdpr/consent-records?limit=1', undefined, token);
    record('INFO', 'Endpoint GDPR acessível', r.status === 200 || r.status === 403,
      `status=${r.status} — verificar se SUPABASE_SERVICE_ROLE_KEY está configurado`);
  } catch (err: any) {
    record('INFO', 'Endpoint GDPR acessível', false, err.message);
  }

  // 6. KPIs de qualidade (linha de base)
  console.log('\n6. KPIs');

  try {
    const r = await request('GET', '/api/kpis/quality?days=7', undefined, token);
    record('INFO', 'Endpoint KPI de qualidade acessível', r.status === 200,
      r.status !== 200 ? `status=${r.status}` : undefined);
  } catch (err: any) {
    record('INFO', 'Endpoint KPI de qualidade acessível', false, err.message);
  }

  // ─── Resultado ────────────────────────────────────────────────────────────
  const errors = results.filter((r) => !r.ok && r.severity === 'ERROR');
  const warns = results.filter((r) => !r.ok && r.severity === 'WARN');
  const passed = results.filter((r) => r.ok);

  console.log(`\n────────────────────────────────────────`);
  console.log(`Resultado: ${passed.length}/${results.length} verificações passaram`);

  if (errors.length > 0) {
    console.log(`\n❌ ${errors.length} erro(s) crítico(s) — tenant não está pronto para operação\n`);
    process.exit(1);
  }

  if (warns.length > 0) {
    console.log(`\n⚠️  ${warns.length} aviso(s) — tenant pode operar, mas revise os itens acima\n`);
    process.exit(0);
  }

  console.log('\n✅ Tenant configurado corretamente — pronto para operar\n');
}

runOnboardingCheck().catch((err) => {
  console.error('\n💥 Erro inesperado no onboarding check:', err.message);
  process.exit(1);
});
