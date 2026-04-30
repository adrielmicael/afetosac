> ⚠️ **ARQUIVO LEGADO** — Use [DEPLOY.md](./DEPLOY.md) como referência canônica.

# 🚀 GUIA DEPLOY - NETLIFY + SUPABASE

---

## 1️⃣ SUPABASE (Backend + Banco)

### A. Criar Projeto
1. Acesse: https://supabase.com
2. Clique "New Project"
3. Preencha:
   - **Name:** `afeto-sac`
   - **Database Password:** (gerar senha forte)
   - **Region:** `South America (Sa East-1)`
   - **Pricing:** Free Tier

### B. Configurar Database
1. Vá em **Database** → **Tables**
2. Execute as migrations (veja abaixo)

### C. Configurar Storage (Uploads)
1. Vá em **Storage** → **New Bucket**
2. **Name:** `uploads`
3. **Public:** ✅ Marcado
4. **Policies:** Copie do arquivo `SUPABASE_STORAGE_SETUP.md`

### D. Pegar Credenciais
Vá em **Project Settings**:

```
# API
SUPABASE_URL=https://xxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# Database
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xxxxxx.supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.xxxxxx.supabase.co:5432/postgres"
```

### E. Rodar Migrations
```bash
cd server
npx prisma migrate dev --name init
npx prisma db seed
```

---

## 2️⃣ NETLIFY (Frontend)

### A. Deploy Frontend
1. Acesse: https://netlify.com
2. Clique **"Add new site"** → **"Import an existing project"**
3. Conecte seu GitHub
4. Selecione o repositório `Afeto SAC`
5. Configurações:
   - **Base directory:** `client`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`

### B. Variáveis de Ambiente (Frontend)
No Netlify Dashboard → **Site settings** → **Environment variables**:

```env
VITE_API_URL=https://api-afeto.onrender.com
# OU se usar Netlify Functions para o backend:
VITE_API_URL=/.netlify/functions/api
```

---

## 3️⃣ DEPLOY DO BACKEND

### Opção A: Render.com (Recomendado - Grátis)
1. Acesse: https://render.com
2. **New Web Service**
3. Conecte GitHub
4. Configurações:
   - **Root Directory:** `server`
   - **Build Command:** `npm install && npx prisma generate`
   - **Start Command:** `npm start`
   - **Plan:** Free

5. **Environment Variables** (copiar tudo do `.env`):
```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
DIRECT_URL=

# Segurança
JWT_SECRET=(gerar string aleatória 32+ chars)
JWT_EXPIRES_IN=7d

# Redis (use Upstash Redis - grátis)
REDIS_URL=rediss://default:...@...-upstash.io:6379

# Stripe (opcional)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# WhatsApp (opcional)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```

### Opção B: Railway.app
Similar ao Render, também tem free tier.

### Opção C: Fly.io
Docker nativo, bom para escalar.

---

## 4️⃣ ARQUITETURA FINAL

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   NETLIFY   │────▶│   RENDER    │────▶│  SUPABASE   │
│  (Frontend) │     │  (Backend)  │     │  (Postgres) │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   UPSTASH   │
                    │   (Redis)   │
                    └─────────────┘
```

---

## 5️⃣ CHECKLIST DEPLOY

### Supabase:
- [ ] Projeto criado
- [ ] Migrations rodadas
- [ ] Bucket `uploads` criado
- [ ] RLS policies configuradas
- [ ] Credenciais copiadas

### Backend (Render):
- [ ] Web Service criado
- [ ] Env vars configuradas
- [ ] Deploy successful
- [ ] Health check: `GET /health`

### Frontend (Netlify):
- [ ] Site conectado ao Git
- [ ] Build settings configuradas
- [ ] Env var `VITE_API_URL` setada
- [ ] Deploy successful

### DNS/Custom Domain (opcional):
- [ ] Dominio comprado (ex: afeto.com)
- [ ] CNAME para Netlify
- [ ] CNAME para Render API

---

## 6️⃣ COMANDOS ÚTEIS

### Testar backend local:
```bash
cd server
npm run dev
# Teste: http://localhost:3001/health
```

### Testar frontend local:
```bash
cd client
npm run dev
# Teste: http://localhost:5173
```

### Logs em produção:
```bash
# Render
render logs --tail

# Netlify
netlify logs --tail
```

---

## 7️⃣ ARQUIVOS DE CONFIG

### `netlify.toml` (já criado):
```toml
[build]
  base = "client"
  publish = "dist"
  command = "npm run build"

[[redirects]]
  from = "/api/*"
  to = "https://api-afeto.onrender.com/api/:splat"
  status = 200
```

### `render.yaml` (opcional - Infrastructure as Code):
```yaml
services:
  - type: web
    name: afeto-api
    env: node
    buildCommand: npm install && npx prisma generate
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
```

---

## 💰 CUSTOS MENSAIS ESTIMADOS

| Serviço | Plano | Custo |
|---------|-------|-------|
| Supabase | Free | R$ 0 |
| Render | Free | R$ 0 |
| Netlify | Free | R$ 0 |
| Upstash Redis | Free | R$ 0 |
| **TOTAL** | | **R$ 0** |

*Limites free geralmente suficientes para começar (até ~1000 usuários)*

---

Pronto! Seu SaaS estará no ar! 🚀
