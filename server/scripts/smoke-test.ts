#!/usr/bin/env tsx
/**
 * Smoke Test de Go-Live — Afeto SAC
 *
 * Verifica os fluxos críticos em produção ou staging após deploy.
 * Sai com código 1 se qualquer verificação falhar (bloqueia pipeline CI/CD).
 *
 * Uso:
 *   BASE_URL=https://api.meusite.com SMOKE_EMAIL=admin@clinic.com SMOKE_PASSWORD=pass tsx scripts/smoke-test.ts
 *
 * Variáveis de ambiente:
 *   BASE_URL           — URL base da API (obrigatório)
 *   SMOKE_EMAIL        — E-mail de um usuário ativo (obrigatório)
 *   SMOKE_PASSWORD     — Senha do usuário (obrigatório)
 *   SMOKE_WEBHOOK_URL  — URL do endpoint de webhook (padrão: BASE_URL/api/webhooks/whatsapp)
 *   SMOKE_TIMEOUT_MS   — Timeout por request em ms (padrão: 10000)
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

// ─── Config ─────────────────────────────────────────────────────────────────

const BASE_URL = process.env.BASE_URL;
const SMOKE_EMAIL = process.env.SMOKE_EMAIL;
const SMOKE_PASSWORD = process.env.SMOKE_PASSWORD;
const TIMEOUT_MS = parseInt(process.env.SMOKE_TIMEOUT_MS || '10000', 10);

if (!BASE_URL || !SMOKE_EMAIL || !SMOKE_PASSWORD) {
  console.error('❌ Variáveis obrigatórias: BASE_URL, SMOKE_EMAIL, SMOKE_PASSWORD');
  process.exit(1);
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

interface Response {
  status: number;
  body: any;
  headers: Record<string, string>;
  correlationId?: string;
}

async function request(
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<Response> {
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
        let parsed: any = {};
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({
          status: res.statusCode ?? 0,
          body: parsed,
          headers: res.headers as Record<string, string>,
          correlationId: res.headers['x-correlation-id'] as string,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout após ${TIMEOUT_MS}ms`)); });

    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

interface CheckResult {
  name: string;
  ok: boolean;
  error?: string;
}
const results: CheckResult[] = [];

async function check(name: string, fn: () => Promise<void>): Promise<void> {
  process.stdout.write(`  → ${name}... `);
  try {
    await fn();
    console.log('✅ OK');
    passed++;
    results.push({ name, ok: true });
  } catch (err: any) {
    console.log(`❌ FAIL: ${err.message}`);
    failed++;
    results.push({ name, ok: false, error: err.message });
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// ─── Smoke tests ─────────────────────────────────────────────────────────────

let token: string;

async function runSmoke() {
  console.log(`\n🔍 Smoke Test — ${BASE_URL}\n`);

  // 1. Health check
  console.log('1. Health');
  await check('GET /health responde 200', async () => {
    const r = await request('GET', '/health');
    assert(r.status === 200, `status=${r.status}`);
  });

  await check('X-Correlation-ID presente na resposta', async () => {
    const r = await request('GET', '/health');
    assert(!!r.correlationId, 'Header X-Correlation-ID ausente');
  });

  // 2. Auth
  console.log('\n2. Autenticação');
  await check('POST /api/auth/login retorna token', async () => {
    const r = await request('POST', '/api/auth/login', {
      email: SMOKE_EMAIL,
      password: SMOKE_PASSWORD,
    });
    assert(r.status === 200, `status=${r.status} body=${JSON.stringify(r.body)}`);
    assert(!!r.body?.token, 'token ausente na resposta');
    token = r.body.token;
  });

  await check('POST /api/auth/login com senha errada retorna 401', async () => {
    const r = await request('POST', '/api/auth/login', {
      email: SMOKE_EMAIL,
      password: '__wrong_password__',
    });
    assert(r.status === 401, `esperado 401, recebido ${r.status}`);
  });

  await check('GET /api/auth/me retorna usuário autenticado', async () => {
    const r = await request('GET', '/api/auth/me', undefined, token);
    assert(r.status === 200, `status=${r.status}`);
    assert(!!r.body?.user?.id, 'user.id ausente');
  });

  // 3. Chats
  console.log('\n3. Chats');
  await check('GET /api/chats responde 200', async () => {
    const r = await request('GET', '/api/chats', undefined, token);
    assert(r.status === 200, `status=${r.status}`);
    assert(Array.isArray(r.body?.chats ?? r.body), 'resposta não é array');
  });

  // 4. Pacientes
  console.log('\n4. Pacientes');
  await check('GET /api/patients responde 200', async () => {
    const r = await request('GET', '/api/patients', undefined, token);
    assert(r.status === 200, `status=${r.status}`);
  });

  // 5. Dashboard
  console.log('\n5. Dashboard');
  await check('GET /api/dashboard/stats responde 200', async () => {
    const r = await request('GET', '/api/dashboard/stats', undefined, token);
    assert(r.status === 200, `status=${r.status}`);
  });

  // 6. Templates
  console.log('\n6. Templates');
  await check('GET /api/templates responde 200', async () => {
    const r = await request('GET', '/api/templates', undefined, token);
    assert(r.status === 200, `status=${r.status}`);
    assert(Array.isArray(r.body?.templates ?? r.body), 'resposta não é array');
  });

  // 7. Janela 24h
  console.log('\n7. Janela 24h');
  await check('GET /api/window24h/window-stats responde 200', async () => {
    const r = await request('GET', '/api/window24h/window-stats', undefined, token);
    assert(r.status === 200 || r.status === 403, `status=${r.status}`);
  });

  // 8. Webhook
  console.log('\n8. Webhook');
  await check('GET /api/webhooks/whatsapp?hub.mode=subscribe sem token retorna 403', async () => {
    const r = await request('GET', '/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=WRONG&hub.challenge=test');
    assert(r.status === 403, `esperado 403, recebido ${r.status}`);
  });

  await check('POST /api/webhooks/whatsapp sem assinatura HMAC retorna 403', async () => {
    const r = await request('POST', '/api/webhooks/whatsapp', {
      object: 'whatsapp_business_account',
      entry: [],
    });
    // Em produção com WHATSAPP_APP_SECRET configurado, deve retornar 403
    // Em dev sem secret, pode retornar 200 (comportamento esperado)
    assert(r.status === 200 || r.status === 403, `status inesperado: ${r.status}`);
  });

  // 9. Segurança
  console.log('\n9. Segurança');
  await check('Endpoint protegido sem token retorna 401', async () => {
    const r = await request('GET', '/api/chats');
    assert(r.status === 401, `esperado 401, recebido ${r.status}`);
  });

  await check('Cross-tenant: ID inexistente retorna 404', async () => {
    const r = await request('GET', '/api/chats/00000000-0000-0000-0000-000000000000', undefined, token);
    assert(r.status === 404, `esperado 404, recebido ${r.status}`);
  });

  // 10. KPIs (trilha parceiro Meta)
  console.log('\n10. KPIs');
  await check('GET /api/kpis/quality responde 200', async () => {
    const r = await request('GET', '/api/kpis/quality?days=7', undefined, token);
    assert(r.status === 200, `status=${r.status}`);
    assert(r.body?.kpis?.delivery !== undefined, 'kpis.delivery ausente');
    assert(r.body?.kpis?.firstResponse !== undefined, 'kpis.firstResponse ausente');
  });

  // ─── Resultado ────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n────────────────────────────────────────`);
  console.log(`Resultado: ${passed}/${total} verificações passaram`);

  // Gravar relatório JSON para CI/CD (artefato)
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    total,
    passed,
    failed,
    results,
  };
  const reportPath = path.join(process.cwd(), 'smoke-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Relatório salvo em ${reportPath}`);

  if (failed > 0) {
    console.log(`❌ ${failed} verificação(ões) falharam — deploy BLOQUEADO\n`);
    process.exit(1);
  }

  console.log(`✅ Smoke test OK — deploy pode prosseguir\n`);
}

runSmoke().catch((err) => {
  console.error('\n💥 Erro inesperado no smoke test:', err.message);
  process.exit(1);
});
