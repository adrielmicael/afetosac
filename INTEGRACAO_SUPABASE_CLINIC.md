# Integração SAC ⇄ Afeto Clinic (importação de pacientes)

O Afeto Clinic é **um único banco Supabase compartilhado** por todas as clínicas,
separadas por `tenant_id`. Por isso as credenciais de acesso (URL + `service_role`)
são **GLOBAIS, de nível desenvolvedor** — configuradas uma vez e **nunca expostas
às clínicas**. Cada clínica do SAC mapeia apenas para o **seu tenant**, e o sistema
lê automaticamente só os dados daquele tenant (leitura, filtrada).

---

## Passo 1 — Configurar as credenciais globais (uma vez, desenvolvedor)

No Supabase do Afeto Clinic: **Settings → API** → copie a **Project URL** e a
**`service_role` key**.

> ⚠️ A `service_role` é poderosa e **não deve aparecer em nenhuma tela de clínica**.
> Ela vive só nas variáveis de ambiente do servidor.

Defina no ambiente (Netlify → Environment variables e/ou `server/.env`):

```
AFETO_CLINIC_SUPABASE_URL="https://<seu-projeto>.supabase.co"
AFETO_CLINIC_SUPABASE_KEY="<service_role_key>"
```

Pronto — a integração fica "disponível" para todas as clínicas.

---

## Passo 2 — Vincular cada clínica ao seu tenant

O **tenant** é um identificador simples (não sensível). Pode ser definido de duas formas:

- **No onboarding:** ao criar a clínica no Console SaaS (botão "Nova clínica"),
  preencha o campo opcional **"Tenant Afeto Clinic"**.
- **Depois:** dentro da clínica, em **Configurações → Integrações → Afeto Clinic**,
  informe o tenant e salve.

> Cada clínica só enxerga e edita o **próprio** tenant. Nunca veem URL nem chave.

---

## Passo 3 — Testar e importar

Em **Configurações → Integrações → Afeto Clinic**:

- **Testar** — confirma a conexão e quantos pacientes existem **para aquele tenant**.
- **Simular importação** (dry-run) — conta o que entraria, **sem gravar nada**.
- **Importar pacientes** — traz os pacientes do tenant para o SAC.

A importação é **somente leitura** no Afeto Clinic, **filtrada pelo tenant** da clínica,
paginada (traz todos), e idempotente. Usa o modelo **Contato × Pacientes**: pacientes
que compartilham o mesmo telefone (ex.: irmãos no número do responsável) ficam sob um
único contato/conversa.

Pelo terminal (uso interno do desenvolvedor), há também:

```bash
cd server
$env:ORG_SLUG="slug-da-clinica"
$env:DRY_RUN="true"      # simula primeiro
npm run clinic:sync
```
