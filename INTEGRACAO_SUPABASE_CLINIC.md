# Integração SAC ⇄ Supabase do Afeto Clinic

Como o SAC lê os pacientes do Supabase do Afeto Clinic — **sem nenhuma alteração
no banco do Clinic**. A leitura é **somente leitura por construção**: o código do
SAC só faz `SELECT`; ele nunca insere, atualiza ou apaga nada no Clinic.

---

## Opção A — `service_role` (ESCOLHIDA) · zero mudanças no Clinic

Usa a **service_role key** que **já existe** nas configurações do Supabase do
Clinic (Dashboard → Project Settings → API → `service_role`). Nenhuma view, role
ou grant precisa ser criada.

> ⚠️ Tudo abaixo roda no **terminal do SAC** (`npm run`). **Nada disso é SQL** —
> não cole no SQL Editor do Supabase. O Supabase do Clinic não é alterado.
>
> Pré-requisitos no `server/.env`: `DATABASE_URL` e `ENCRYPTION_KEY`, e a
> organização (tenant) já criada no SAC. Os comandos rodam de dentro de `server/`.

### Passo 1 — Pegar a chave (e tratá-la como segredo)

No Supabase do Clinic: **Settings → API → Project API keys → `service_role`**.

> A `service_role` é poderosa. **Não cole no chat nem comite em arquivo.** Ela vai
> só para variável de ambiente do comando, e o SAC a grava **cifrada** (AES-256-GCM).

### Passo 2 — Configurar (cifra e habilita)

```powershell
cd server
$env:ORG_SLUG="clinica-afeto"                                  # slug do tenant no SAC
$env:CLINIC_SUPABASE_URL="https://eyaampjyhduydpxuieve.supabase.co"
$env:CLINIC_SUPABASE_KEY="<SERVICE_ROLE_KEY>"
npm run clinic:config
```

### Passo 3 — Simular ANTES de gravar (dry-run — padrão seguro)

```powershell
$env:ORG_SLUG="clinica-afeto"
npm run clinic:sync     # DRY_RUN é true por padrão: lê e conta, NÃO grava
```
Mostra as **colunas detectadas**, o **total na origem** e
`{ total, eligible, upserted: 0, skipped, dryRun: true }`
(`eligible` = quantos têm telefone e seriam importados; `skipped` = sem telefone).

### Passo 4 — Importar de verdade

```powershell
$env:DRY_RUN="false"
npm run clinic:sync
```
Lê a base **inteira, paginada de 1000 em 1000** e faz `upsert` por
(organização + telefone). É **idempotente** — pode rodar quantas vezes quiser.

> **Alternativa via API** (quando houver a tela de admin no frontend): os mesmos
> passos existem como `PUT /api/organizations/afeto-clinic` (config) e
> `GET .../supabase/test` / `POST .../supabase/sync-patients` (`{ "dryRun": true }`).
> São chamadas HTTP ao backend do SAC — **não** SQL.

### Garantias de segurança

- **Somente leitura no Clinic**: o serviço só chama `.select(...)`. Não há
  caminho de escrita para o Clinic no código.
- **Aditivo no SAC**: nunca apaga pacientes (mesmo que sumam na origem).
- **Chave cifrada** em repouso; mascarada (`••••xxxx`) ao ler a config.
- **Rotação**: troque a `service_role` no Supabase e atualize no SAC quando quiser.

---

## Opção B — view + token restrito (alternativa mais segura, mas mexe no Clinic)

Só vale a pena se você **não** quiser que o SAC tenha a `service_role`. Cria uma
view `patients_sync` (só as colunas necessárias) + uma role `sac_readonly` que só
lê essa view + um token que carrega só essa role. É **aditivo** (não altera nada
existente), mas exige rodar SQL no Clinic. O SQL e o passo a passo estão no
histórico desta integração — peça que eu reponho aqui se decidir migrar depois.

Resumo do SQL (referência):

```sql
create or replace view public.patients_sync as
  select id, name, phone, email, responsible, age from public.patients;
create role sac_readonly nologin noinherit;
grant sac_readonly to authenticator;
grant usage on schema public to sac_readonly;
grant select on public.patients_sync to sac_readonly;
notify pgrst, 'reload schema';
```
E um JWT `{ role: 'sac_readonly' }` assinado com o JWT Secret do projeto vira a
"chave" do SAC. Ao usar a Opção B, chame os endpoints com `table=patients_sync`.

---

## Mapeamento de colunas

O sync aceita variações pt/en e ignora registros sem telefone:

| Campo no SAC | Colunas aceitas (em ordem) |
|---|---|
| nome | `name`, `nome`, `full_name` |
| telefone (chave) | `phone`, `telefone`, `celular`, `whatsapp` |
| email | `email`, `e_mail` |
| responsável | `responsible`, `responsavel`, `guardian` |
| idade | `age`, `idade` |

Rode o `/supabase/test` e confira em `columns` se algum nome diverge — é só me
avisar que eu ajusto o mapeamento.
