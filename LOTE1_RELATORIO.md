# Lote 1 — Governança de Segredos e Hardening de Produção

## Status: ✅ CONCLUÍDO

---

## Critérios de Aceite

| Critério | Status |
|----------|--------|
| Build backend sem erros | ✅ |
| Build frontend sem erros | ✅ (Lote 0 validado) |
| Nenhum segredo com fallback inseguro em produção | ✅ |
| Validação de variáveis obrigatórias na inicialização | ✅ |
| Webhook HMAC rejeita requisições em produção sem `WHATSAPP_APP_SECRET` | ✅ |

---

## Mudanças Implementadas

### 1. `server/src/config/env.ts` (novo)
- `validateEnvironment()`: lança erro fatal na inicialização se variáveis obrigatórias estiverem ausentes.
- Em produção: exige `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`.
- Em desenvolvimento: valida apenas `DATABASE_URL` e `JWT_SECRET`.

### 2. `server/src/index.ts`
- Chama `validateEnvironment()` logo após `dotenv.config()`.
- Processo encerra na inicialização se faltar variável obrigatória — fail-fast seguro.

### 3. `server/src/controllers/authController.ts`
- Removido fallback `|| 'secret'` do `jwt.sign` → usa `process.env.JWT_SECRET!`.
- Garantia: `validateEnvironment()` já terá falhado antes se JWT_SECRET estiver ausente.

### 4. `server/src/middleware/auth.ts`
- Removido fallback `|| 'secret'` do `jwt.verify` → usa `process.env.JWT_SECRET!`.

### 5. `server/src/controllers/webhookController.ts`
- Em produção: retorna `false` (rejeita webhook) quando `WHATSAPP_APP_SECRET` não está configurado.
- Em desenvolvimento: continua com warning (compatibilidade com testes locais sem credenciais reais).

### 6. `server/scripts/validate-env.ts` (novo)
- Script standalone: `npm run validate:env`
- Útil para checar configuração antes de deploy (CI/CD ou manual).

---

## Segurança

- Elimina risco de JWT assinado com chave `"secret"` vazar em produção.
- Webhook Meta sem HMAC em produção agora é bloqueado — não apenas logado.
- Fail-fast na inicialização é padrão OWASP A02 (Cryptographic Failures).

---

## Próximo Lote

**Lote 2** — Política de mensagens e template HSM:
- Validação do tipo de mensagem vs. janela 24h
- Envio de template HSM quando janela fechada
- Persistência de `templateId` nas mensagens outbound
