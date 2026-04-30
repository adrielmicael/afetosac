# Lote 3 - Runbook Operacional de Incidentes

Este runbook cobre resposta rapida para incidentes do fluxo oficial Meta/WhatsApp.

## 1) Token expirado / invalido

### Sinais
- Erros `401/403` em envios outbound.
- Logs de falha em `whatsappService`.
- Crescimento de eventos `DEAD_LETTER` com motivo de autenticacao.

### Acao imediata
1. Confirmar variaveis de ambiente de token no backend.
2. Validar permissao no provedor Meta Business.
3. Atualizar token e reiniciar apenas o processo afetado.

### Validacao
1. Executar envio de mensagem teste para um chat controlado.
2. Confirmar status `DELIVERED` em `messages`.
3. Confirmar queda no volume de `DEAD_LETTER`.

## 2) Webhook fora do ar ou sem entrega

### Sinais
- Conversas sem mensagens inbound recentes.
- Falha em health-check de endpoint webhook.
- Alertas de tentativas consecutivas sem sucesso.

### Acao imediata
1. Validar disponibilidade do endpoint `/webhooks/whatsapp`.
2. Verificar assinatura/segredo do webhook.
3. Reenfileirar eventos pendentes no provedor, quando suportado.

### Validacao
1. Disparar evento de teste do provedor.
2. Confirmar criacao de mensagem inbound no banco.
3. Confirmar reabertura de janela 24h quando aplicavel.

## 3) Indisponibilidade do provedor Meta

### Sinais
- Timeout em lote e aumento de latencia.
- Sequencia de retries com falha.
- Muitos registros `DEAD_LETTER` em pouco tempo.

### Acao imediata
1. Confirmar status oficial do provedor.
2. Manter retries com backoff (ja habilitado no servico).
3. Acionar comunicacao interna: "degradacao externa".

### Validacao
1. Aguardar retorno de disponibilidade.
2. Reprocessar mensagens mortas de forma controlada.
3. Monitorar taxa de sucesso por 30 minutos.

## 4) Falha de banco de dados (Supabase/PostgreSQL)

### Sinais
- Erros de conexao ou timeout Prisma.
- Falhas simultaneas em escrita de mensagens e atividades.
- Health interno degradado.

### Acao imediata
1. Confirmar conectividade e credenciais.
2. Verificar limite de conexoes e pool.
3. Aplicar modo de contencao: evitar novas operacoes destrutivas.

### Validacao
1. Executar leitura simples e escrita de teste.
2. Confirmar retorno dos endpoints criticos.
3. Revisar backlog de envio apos recuperacao.

## 5) Operacao de dead-letter

### Onde consultar
- Tabela de atividades (`type = DEAD_LETTER`).
- Campos de metadados com `queue`, `chatId`, `messageId`, `error`, `correlationId`.

### Procedimento de reprocessamento
1. Filtrar por causa raiz (token, timeout, payload invalido).
2. Corrigir causa raiz antes de reenviar.
3. Reenviar manualmente por lote pequeno e monitorado.

### Boas praticas
- Sempre usar `correlationId` para rastrear ponta-a-ponta.
- Evitar reprocessar massa sem amostragem previa.
- Registrar incidente e acao corretiva para auditoria.

## 6) Checklist pos-incidente

1. Causa raiz documentada.
2. Evidencias (logs, IDs, horarios) anexadas.
3. Acao preventiva criada no backlog tecnico.
4. Comunicacao de encerramento para operacao.
