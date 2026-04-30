> ⚠️ **ARQUIVO LEGADO** — Use [DEPLOY.md](./DEPLOY.md) como referência canônica.

# 🚀 CONFIGURAÇÃO APENAS SUPABASE + NETLIFY (SEM UPSTASH)

## ✅ CÓDIGO AJUSTADO!

O sistema agora funciona **100% com apenas Supabase + Netlify**.

**O Upstash (Redis) é OPCIONAL!** Se não configurado, o sistema usa o PostgreSQL do Supabase para:
- ✅ Cache
- ✅ Filas (jobs)
- ✅ Rate limiting

---

## 📋 O QUE MUDOU

### Antes (com Redis obrigatório):
```
Netlify + Supabase + Upstash Redis
```

### Agora (apenas Supabase + Netlify):
```
Netlify (Frontend + Functions)
    ↓
Supabase (PostgreSQL + Storage + Realtime + Cache + Filas)
```

---

## 🎯 PASSO A PASSO SIMPLIFICADO

### 1️⃣ CRIAR SUPABASE

**Acesse:** https://supabase.com

1. Novo projeto:
   - **Name:** `afeto-sac`
   - **Database Password:** (guarde!)
   - **Region:** `South America (Sa East-1)`
   - **Plan:** Free

2. Pegar credenciais em **Project Settings → API**:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

3. Pegar credenciais em **Project Settings → Database**:
```
DATABASE_URL="postgresql://postgres:[SENHA]@db.xxxxxx.supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[SENHA]@db.xxxxxx.supabase.co:5432/postgres"
```

4. Configurar Storage:
   - **Storage → New Bucket**
   - **Name:** `uploads`
   - **Public:** ✅ Marcado
   - Adicionar policies (ver guia anterior)

5. Ativar Realtime:
   - **Database → Replication**
   - Ativar para tabelas: `messages`, `chats`

---

### 2️⃣ CRIAR NETLIFY

**Acesse:** https://netlify.com

1. **Add new site → Import from Git**
2. Conectar GitHub
3. Configurar build:
   - **Build command:** `npm run build`
   - **Publish directory:** `client/dist`
   - **Functions directory:** `netlify/functions`

4. Adicionar Environment Variables:
```env
# Supabase (OBRIGATÓRIO)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:...
DIRECT_URL=postgresql://postgres:...

# Segurança (OBRIGATÓRIO)
JWT_SECRET=(gerar string de 64 caracteres aleatórios)
JWT_EXPIRES_IN=7d
ALLOWED_ORIGINS=https://seu-site.netlify.app

# Opcionais (quando for usar)
STRIPE_SECRET_KEY=sk_...
WHATSAPP_ACCESS_TOKEN=...
```

**Nota:** NÃO precisa de `REDIS_URL`!

---

### 3️⃣ RODAR MIGRATIONS

```bash
cd server
npx prisma migrate dev --name init
npx prisma db seed
```

---

### 4️⃣ DEPLOY

```bash
git add .
git commit -m "Ajustes serverless - apenas Supabase + Netlify"
git push origin main
```

O Netlify faz deploy automático!

---

## 🏗️ ARQUITETURA FINAL

```
┌─────────────────────────────────────────┐
│              NETLIFY                    │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │  Frontend    │  │  API Functions  │  │
│  │  (React)     │  │  (Serverless)   │  │
│  └──────────────┘  └────────┬────────┘  │
└─────────────────────────────┼───────────┘
                              │
                    ┌─────────┴───────────┐
                    │                     │
            ┌───────▼──────┐      ┌───────▼────────┐
            │  PostgreSQL  │      │    Storage     │
            │    (Cache)   │      │   (Uploads)    │
            │   (Filas)    │      │                │
            └──────────────┘      └────────────────┘
                    │
            ┌───────▼──────┐
            │   Realtime   │
            │  (WebSocket) │
            └──────────────┘
```

---

## 💰 CUSTO: R$ 0

| Serviço | Plano | Custo |
|---------|-------|-------|
| Supabase | Free | R$ 0 |
| Netlify | Free | R$ 0 |
| **TOTAL** | | **R$ 0** |

---

## ⚡ PERFORMANCE

Sem Redis (usando PostgreSQL):
- ✅ **Cache:** 5-10ms (vs 1-2ms no Redis) - aceitável
- ✅ **Filas:** Funciona perfeitamente
- ✅ **Rate Limit:** Funciona perfeitamente
- ⚠️ **Alta escala:** Quando passar de 10k usuários, aí sim considerar Redis

---

## 🔄 QUER ADICIONAR REDIS DEPOIS?

É fácil! Só adicionar a env var `REDIS_URL` no Netlify que o sistema automaticamente muda para usar Redis.

---

## ✅ CHECKLIST

- [ ] Criar conta Supabase
- [ ] Criar projeto `afeto-sac`
- [ ] Copiar credenciais
- [ ] Criar bucket `uploads`
- [ ] Ativar Realtime
- [ ] Criar conta Netlify
- [ ] Conectar GitHub
- [ ] Adicionar env vars
- [ ] Rodar migrations
- [ ] Deploy!

---

**PRONTO! Apenas 2 serviços para gerenciar! 🎉**
