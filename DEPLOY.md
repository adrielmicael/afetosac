# Deploy — Afeto SAC

> **Este é o documento canônico de deploy.**
> Os arquivos CONFIGURACAO_SIMPLES.md, CONFIGURACAO_SUPABASE_NETLIFY.md, DEPLOY_GUIDE.md e RESUMO_CONFIGURACAO.md são legados e não devem ser usados como referência primária.

---

## Arquitetura

```
Netlify (Frontend React + Functions serverless)
    ↓ /api/*
Netlify Functions  →  server/src  (Express via serverless-http)
    ↓
Supabase (PostgreSQL + Storage + Realtime)
    ↓ (opcional)
Upstash Redis (cache e filas BullMQ)
```

Redis é **opcional**. Sem ele, o sistema usa fallback em PostgreSQL para cache e filas.

---

## 1. Supabase

### 1.1 Criar projeto

1. Acesse https://supabase.com e crie um novo projeto.
   - **Name:** `afeto-sac` (ou nome do tenant)
   - **Region:** `South America (São Paulo)`
   - **Password:** gerar senha forte e guardar com segurança

### 1.2 Coletar credenciais

Em **Project Settings → API**:
```
SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Em **Project Settings → Database**:
```
DATABASE_URL="postgresql://postgres:[SENHA]@db.xxxxxx.supabase.co:5432/postgres?sslmode=require"
DIRECT_URL="postgresql://postgres:[SENHA]@db.xxxxxx.supabase.co:5432/postgres?sslmode=require"
```

### 1.3 Rodar migrations

```bash
cd server
npx prisma migrate deploy   # produção
# ou
npx prisma migrate dev      # dev com prompt
npx prisma db seed          # seed inicial (opcional)
```

### 1.4 Configurar Storage

1. **Storage → New Bucket** → nome `uploads` → marcar como público
2. Executar no SQL Editor do Supabase:

```sql
CREATE POLICY "public_read" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'uploads');

CREATE POLICY "auth_upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "auth_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'uploads');
```

### 1.5 Ativar Realtime

**Database → Replication** → ativar para `messages` e `chats`.

---

## 2. Netlify

### 2.1 Conectar repositório

1. Acesse https://netlify.com → **Add new site → Import existing project**
2. Conectar GitHub → selecionar repositório
3. Configurações de build:
   - **Base directory:** *(vazio — raiz)*
   - **Build command:** `npm run build:client && cd server && npx prisma generate`
   - **Publish directory:** `client/dist`
   - **Functions directory:** `netlify/functions`

O arquivo `netlify.toml` já tem todas estas configurações — o Netlify as detecta automaticamente.

### 2.2 Variáveis de ambiente

Configure em **Site Settings → Environment Variables**:

#### Obrigatórias
| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL Supabase |
| `DIRECT_URL` | Mesmo que DATABASE_URL (Prisma migrations) |
| `JWT_SECRET` | Mínimo 32 caracteres aleatórios |
| `WHATSAPP_ACCESS_TOKEN` | Token de acesso Meta Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número WhatsApp Business |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Token de verificação do webhook |
| `WHATSAPP_APP_SECRET` | App Secret Meta para validação HMAC |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave pública Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (acesso total, nunca expor no cliente) |
| `ALLOWED_ORIGINS` | Domínios autorizados para CORS, separados por vírgula |
| `NODE_ENV` | `production` |

#### Opcionais
| Variável | Descrição |
|---|---|
| `REDIS_URL` | Upstash Redis (cache + filas). Se ausente: fallback PostgreSQL |
| `STRIPE_SECRET_KEY` | Cobrança via Stripe |
| `STRIPE_WEBHOOK_SECRET` | Assinatura dos eventos Stripe |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WABA ID (necessário para trilha parceiro Meta) |

---

## 3. WhatsApp Cloud API

### 3.1 Configurar webhook no Meta for Developers

1. **App Dashboard → WhatsApp → Configuration → Webhook**
2. **Callback URL:** `https://SEU_SITE.netlify.app/api/webhooks/whatsapp`
3. **Verify Token:** mesmo valor de `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
4. Assinar: `messages`, `message_deliveries`, `message_reads`

### 3.2 Verificar modo Live

- App em modo **Live** (não Development)
- Número validado para produção
- WABA com status `Approved`

---

## 4. Checklist pré-go-live (15 min)

Execute antes de cada deploy em produção:

```bash
# No servidor ou CI/CD — valida variáveis e segurança
cd server && npm run precheck
```

Itens manuais:
- [ ] JWT_SECRET tem ao menos 32 chars aleatórios
- [ ] WHATSAPP_APP_SECRET configurado (valida HMAC do webhook)
- [ ] DATABASE_URL usa `sslmode=require`
- [ ] ALLOWED_ORIGINS inclui apenas domínios legítimos
- [ ] Nenhum segredo hardcoded no repositório
- [ ] Migrations aplicadas (`prisma migrate deploy`)
- [ ] Webhook Meta apontando para a URL correta

---

## 5. Smoke test pós-deploy

Execute após cada deploy para validar os fluxos críticos:

```bash
BASE_URL=https://SEU_SITE.netlify.app \
SMOKE_EMAIL=admin@suaclinica.com \
SMOKE_PASSWORD=SENHA_DO_ADMIN \
cd server && npm run smoke
```

O script sai com código `1` se qualquer verificação crítica falhar — bloqueando automação CI/CD.

Fluxos verificados:
1. Health check (`/health`)
2. Autenticação (login, me, senha errada)
3. Listagem de chats
4. Listagem de pacientes
5. Dashboard stats
6. Templates HSM
7. Janela 24h
8. Webhook WhatsApp (verificação e rejeição de payload inválido)
9. Segurança (acesso sem token, cross-tenant)

---

## 6. Redis (opcional — Upstash)

Para ativar cache distribuído e filas:

1. Crie conta em https://upstash.com
2. **Create Database → Redis → Region: São Paulo**
3. Copie a connection string e adicione ao Netlify:
   ```
   REDIS_URL=redis://default:SENHA@...upstash.io:PORT
   ```

Sem Redis, o sistema funciona normalmente com fallback PostgreSQL.

---

## 7. Troubleshooting rápido

| Sintoma | Causa provável | Ação |
|---|---|---|
| Login falhando com 401 | JWT_SECRET diferente entre deploys | Verificar variável de ambiente |
| Webhook retorna 403 | WHATSAPP_APP_SECRET incorreto ou ausente | Reconfigurar no Netlify |
| Mensagens não chegam | Webhook não configurado na Meta | Conferir URL e token no Meta Dashboard |
| Upload falhando | Bucket `uploads` não existe ou política ausente | Recriar bucket e policies Supabase |
| Banco não conecta | DATABASE_URL incorreta ou sem SSL | Verificar string com `sslmode=require` |
| Smoke test falhando em `/api/chats` | Token JWT expirado ou usuário sem org ativa | Checar seed e membership |

---

## 8. Rotação de segredos

Procedimento mínimo (executar trimestralmente):

1. Gerar novo `JWT_SECRET` (32+ chars): `openssl rand -base64 48`
2. Renovar `WHATSAPP_ACCESS_TOKEN` no Meta for Developers
3. Atualizar variáveis no Netlify → fazer novo deploy
4. Executar smoke test para confirmar operação
5. Registrar data da rotação no log de operações da clínica
