> ⚠️ **ARQUIVO LEGADO** — Use [DEPLOY.md](./DEPLOY.md) como referência canônica.

# 🚀 CONFIGURAÇÃO SUPABASE + NETLIFY

## ✅ CÓDIGO JÁ AJUSTADO!

O sistema foi adaptado para rodar 100% serverless com:
- ✅ **Netlify Functions** (backend serverless)
- ✅ **Supabase** (PostgreSQL + Storage + Realtime)
- ✅ **Upstash Redis** (cache e filas - free tier)

---

## 📋 PASSO A PASSO

### 1️⃣ CRIAR CONTA SUPABASE

**Acesse:** https://supabase.com

1. Clique **"New Project"**
2. Preencha:
   - **Name:** `afeto-sac`
   - **Database Password:** (guarde essa senha!)
   - **Region:** `South America (Sa East-1)` São Paulo
   - **Pricing:** Free Tier
3. Aguarde criar (2-3 minutos)

---

### 2️⃣ CONFIGURAR SUPABASE

#### A. Pegar Credenciais
Vá em **Project Settings** → **API**:

```
SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

Vá em **Project Settings** → **Database**:

```
DATABASE_URL="postgresql://postgres:[SENHA]@db.xxxxxx.supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[SENHA]@db.xxxxxx.supabase.co:5432/postgres"
```

#### B. Configurar Storage (Uploads)
1. Vá em **Storage** → **New Bucket**
2. **Name:** `uploads`
3. **Public bucket:** ✅ Marcado
4. Clique **Create bucket**

5. Clique no bucket `uploads` → **Policies** → **New Policy**
6. Cole este SQL:

```sql
-- Permitir SELECT público
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'uploads');

-- Permitir INSERT autenticado
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'uploads');

-- Permitir DELETE do próprio arquivo
CREATE POLICY "Allow own delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'uploads');
```

#### C. Ativar Realtime
1. Vá em **Database** → **Replication**
2. Ative **Realtime** para as tabelas:
   - `messages`
   - `chats`

---

### 3️⃣ CRIAR CONTA UPSTASH (REDIS)

**Acesse:** https://upstash.com

1. Crie conta (gratuita)
2. Clique **"Create Database"**
3. **Name:** `afeto-redis`
4. **Region:** `SA-EAST-1` (mesmo do Supabase)
5. **Type:** Redis

**Pegar credenciais:**
```
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

---

### 4️⃣ CRIAR CONTA NETLIFY

**Acesse:** https://netlify.com

1. Cadastre-se com GitHub
2. Clique **"Add new site"** → **"Import an existing project"**
3. Selecione seu repositório `Afeto SAC`
4. Configurações de build:
   - **Build command:** `npm run build`
   - **Publish directory:** `client/dist`
   - **Functions directory:** `netlify/functions`

---

### 5️⃣ CONFIGURAR VARIÁVEIS DE AMBIENTE (NETLIFY)

No Netlify Dashboard → **Site settings** → **Environment variables**:

```env
# Supabase (obrigatório)
SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:...
DIRECT_URL=postgresql://postgres:...

# Upstash Redis (obrigatório)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Segurança (obrigatório)
JWT_SECRET=(cole aqui uma string aleatória de 64 caracteres)
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=https://seu-site.netlify.app,http://localhost:5173

# Stripe (quando for ativar pagamentos)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...

# WhatsApp (quando for integrar)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

# Frontend URL
FRONTEND_URL=https://seu-site.netlify.app
```

---

### 6️⃣ DEPLOY

1. No terminal local:
```bash
npm install
npm run install:all
```

2. Rode as migrations:
```bash
cd server
npx prisma migrate dev --name init
npx prisma db seed
```

3. Commit e push:
```bash
git add .
git commit -m "Config serverless"
git push origin main
```

4. O Netlify faz deploy automático!

---

### 7️⃣ VERIFICAR DEPLOY

**Teste a API:**
```
https://seu-site.netlify.app/api/health
```

Deve retornar:
```json
{
  "status": "ok",
  "env": "netlify-functions"
}
```

**Teste o frontend:**
```
https://seu-site.netlify.app
```

---

## 🔧 ARQUITETURA FINAL

```
┌──────────────────────────────────────────┐
│              NETLIFY                     │
│  ┌──────────────┐  ┌─────────────────┐   │
│  │  Frontend    │  │  API Functions  │   │
│  │  (React)     │  │  (Serverless)   │   │
│  └──────────────┘  └────────┬────────┘   │
└─────────────────────────────┼────────────┘
                              │
        ┌─────────────────────┴─────────────┐
        │                                 │
┌───────▼────────┐              ┌─────────▼─────────┐
│   SUPABASE     │              │     UPSTASH       │
│  ├─ PostgreSQL │              │  (Redis Cache)    │
│  ├─ Storage    │              │                   │
│  └─ Realtime   │              │  (Filas QStash)   │
└────────────────┘              └───────────────────┘
```

---

## 💰 CUSTOS (Mensais)

| Serviço | Plano | Custo |
|---------|-------|-------|
| Supabase | Free | R$ 0 |
| Netlify | Free | R$ 0 |
| Upstash Redis | Free | R$ 0 |
| Upstash QStash | Free | R$ 0 |
| **TOTAL** | | **R$ 0** |

---

## ⚠️ LIMITAÇÕES DO PLANO FREE

| Serviço | Limite |
|---------|--------|
| Supabase | 500MB DB, 1GB Storage, 2GB transfer |
| Netlify | 100GB banda, 125k requests/mês |
| Upstash | 10k requests/dia |

**Suficiente para começar (até ~1000 usuários)**

---

## 🆘 SUPORTE

Se der erro no deploy:
1. Verifique os logs no Netlify Dashboard → **Functions**
2. Confirme todas as env vars estão setadas
3. Verifique se as migrations rodaram

---

**PRONTO! Seu SaaS está no ar! 🚀**
