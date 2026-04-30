# LOTE 14 - ENTRADA OFICIAL (WHATSAPP SAC + META)

## Objetivo
Colocar o sistema em operacao oficial com Netlify + Supabase + WhatsApp Cloud API, com seguranca, isolamento multi-tenant e checklist de conformidade para operacao comercial.

## Regra de Execucao
- Ordem: do risco mais alto para o mais simples.
- Cada lote so inicia quando o lote anterior tiver 100% dos criterios de aceite.
- Sempre executar validacao dupla: teste funcional + teste de regressao.

---

## LOTE 0 (P0) - BLOQUEADORES DE GO-LIVE
Prioridade maxima. Sem isso, nao entra oficialmente.

### 0.1 Corrigir compilacao do backend
- Ajustar erro de sintaxe em `server/src/controllers/twoFactorController.ts`.
- Rodar build completo backend e frontend.

Criterios de aceite:
- `npm run build` no backend sem erros.
- `npm run build` no client sem erros.

Teste adicional:
- Reexecutar build em ambiente limpo (sem cache) para validar reproducao.

### 0.2 Fechar isolamento multi-tenant no backend (organizationId em todas as queries)
- Injetar contexto de organizacao no token/sessao.
- Aplicar filtro de `organizationId` em controllers de pacientes, chats, mensagens, GDPR e webhook.
- Bloquear acesso cross-tenant em GET/POST/PUT/DELETE.

Criterios de aceite:
- Usuario de organizacao A nao enxerga nem altera dados da organizacao B.
- Testes de API cobrindo cenarios de negacao (403/404) para cross-tenant.

Teste adicional:
- Teste de tentativa de enumeracao de IDs entre tenants.

### 0.3 Fortalecer webhook da Meta (assinatura)
- Implementar validacao de assinatura `x-hub-signature-256` com App Secret.
- Rejeitar payloads sem assinatura valida.
- Garantir parser de body compativel com verificacao HMAC.

Criterios de aceite:
- Webhook invalido retorna 401/403.
- Webhook valido processa normalmente.

Teste adicional:
- Replay de payload antigo com assinatura invalida deve falhar.

### 0.4 Ajustar parsing de eventos oficiais do WhatsApp
- Revisar campos de status do webhook conforme Cloud API (ex.: `statuses`).
- Persistir e mapear corretamente `sent`, `delivered`, `read`, `failed`.

Criterios de aceite:
- Mudanca de status refletida no banco e no front em tempo real.

Teste adicional:
- Simular fluxo completo: envio -> entregue -> lido.

---

## LOTE 1 (P1) - OPERACAO OFICIAL MINIMA (META + PROD)

### 1.1 Conta oficial Meta pronta para producao
- Business Manager verificado.
- WABA ativa.
- Numero validado e habilitado para producao.
- App com modo Live e permissoes corretas.

Criterios de aceite:
- Envio/recebimento em numero real fora de sandbox.

### 1.2 Governanca de credenciais e segredos
- Segredos apenas em variaveis de ambiente (Netlify/Supabase).
- Rotacao de token e plano de expiracao.
- Segregar segredos por ambiente (dev/staging/prod).

Criterios de aceite:
- Nenhum segredo em codigo/repositorio.
- Procedimento documentado de rotacao executado ao menos 1 vez.

### 1.3 Politica de mensagens e templates
- Templates aprovados (utility/marketing/authentication) por caso de uso.
- Regra de janela de 24h aplicada no backend.
- Fora da janela: apenas template aprovado.

Criterios de aceite:
- Bloqueio tecnico de envio fora de politica.
- Log do motivo do bloqueio para auditoria.

Teste adicional:
- Tentar envio livre fora da janela e validar negacao.

---

## LOTE 2 (P1) - LGPD E AUDITORIA PARA CLINICAS

### 2.1 Consentimento e base legal por finalidade
- Separar consentimentos de atendimento vs marketing.
- Versionar politica e termos no registro de consentimento.

Criterios de aceite:
- Marketing so dispara com opt-in valido.
- Revogacao reflete imediatamente no fluxo de comunicacao.

### 2.2 Trilha de auditoria robusta
- Registrar `created_at`, `updated_at`, `created_by` nas entidades sensiveis.
- Logar acessos a dados clinicos com usuario, org, IP e acao.

Criterios de aceite:
- Relatorio de auditoria exportavel por periodo e por paciente.

### 2.3 Processo operacional de direitos do titular
- Fluxos de exportacao, anonimização e revogacao com SLA interno.
- Evidencia de execucao por ticket/protocolo.

Criterios de aceite:
- Simulacao completa de solicitacao LGPD concluida ponta a ponta.

---

## LOTE 3 (P2) - CONFIABILIDADE E SUPORTE 24x7

### 3.1 Observabilidade
- Correlation ID por requisicao/mensagem.
- Dashboards para webhook, erro de envio, latencia e filas.
- Alertas para erro 5xx, falha de webhook e queda de throughput.

Criterios de aceite:
- Alerta disparado e tratado em teste controlado de falha.

### 3.2 Resiliencia
- Retry com backoff para erros transientes da Meta.
- Idempotencia para eventos webhook duplicados.
- Dead-letter para falhas permanentes.

Criterios de aceite:
- Evento duplicado nao gera duplicidade funcional.

### 3.3 Runbooks de incidente
- Playbooks para: token expirado, webhook fora, queda de provider, falha de banco.

Criterios de aceite:
- Time consegue restaurar operacao em teste de mesa.

---

## LOTE 4 (P3) - SIMPLIFICACOES (GANHO RAPIDO)
Mais simples, com alto valor operacional.

### 4.1 Padronizar documentacao unica de deploy
- Consolidar arquivos de deploy para evitar instrucoes conflitantes.

### 4.2 Checklist de pre-go-live
- Checklist de 15 min para cada deploy em producao.

### 4.3 Smoke test automatizado
- Rodar script curto apos deploy: login, listagem, envio WhatsApp, webhook, dashboard.

Criterios de aceite:
- Pipeline bloqueia release se smoke test falhar.

---

## LOTE 5 (P3) - TRILHA PARCEIRO META (OPCIONAL, APOS ESTABILIDADE)

Importante:
- Operar oficialmente via Cloud API nao exige, por si so, virar parceiro formal.
- Parceria formal exige maturidade comercial e operacional maior.

### 5.1 Preparacao comercial e tecnica
- Evidencias de seguranca, compliance, suporte e qualidade de entrega.
- Processo de onboarding de clientes com baixa friccao.

### 5.2 Escala e qualidade
- KPIs: taxa de entrega, leitura, tempo de primeira resposta, erro de webhook, disponibilidade.

### 5.3 Processo com Meta
- Seguir trilha vigente no ecossistema de parceiros da Meta (requisitos podem mudar).
- Formalizar aplicacao quando os lotes 0 a 4 estiverem estaveis.

---

## Cronograma sugerido
- Semana 1: Lote 0
- Semana 2: Lotes 1 e 2
- Semana 3: Lote 3
- Semana 4: Lotes 4 e 5

## Go/No-Go final
Liberar operacao oficial somente se:
- Lotes 0, 1 e 2 com 100% de aceite.
- Zero erro critico aberto em seguranca, isolamento tenant e webhook.
- Smoke test e testes de regressao passando em producao controlada.
