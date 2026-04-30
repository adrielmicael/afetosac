# Trilha Parceiro Meta — Afeto SAC

> **Este é um objetivo opcional e de médio prazo.**
> Operar via WhatsApp Cloud API não exige parceria formal com a Meta.
> Este guia é para quando Lotes 0-4 estiverem estáveis e a escala comercial justificar a candidatura.

---

## Por que se tornar parceiro?

Parceiros oficiais Meta (anteriormente "Business Solution Providers") têm acesso a:
- Suporte técnico prioritário
- Limites de envio expandidos mais rapidamente
- Acesso antecipado a novos recursos da plataforma
- Maior credibilidade junto a clientes corporativos

---

## Pré-requisitos técnicos (evidências coletáveis hoje)

Execute `npm run precheck` — os itens `[Meta Partner]` validam:

| Evidência | Variável de ambiente | Status |
|---|---|---|
| WABA ativa em modo Live | `WHATSAPP_BUSINESS_ACCOUNT_ID` | Verificado pelo precheck |
| App ID registrado no Meta | `WHATSAPP_APP_ID` | Verificado pelo precheck |
| Assinatura HMAC habilitada | `WHATSAPP_APP_SECRET` | Verificado pelo precheck |
| TLS não desabilitado | `NODE_TLS_REJECT_UNAUTHORIZED` | Verificado pelo precheck |
| Partner ID (após candidatura) | `META_PARTNER_ID` | Preencher quando aprovado |

---

## KPIs de qualidade exigidos

Execute `GET /api/kpis/quality?days=30` para obter as métricas atuais.

A Meta avalia candidatos por benchmarks aproximados:

| KPI | Meta recomendada | Endpoint |
|---|---|---|
| Taxa de entrega | ≥ 95% | `kpis.delivery.deliveryRate` |
| Taxa de leitura | ≥ 40% | `kpis.reading.readRate` |
| Tempo 1ª resposta | ≤ 5 minutos (média) | `kpis.firstResponse.avgFirstResponseSeconds` |
| Erros de webhook | < 1% dos eventos | `kpis.webhookErrors.count` |

> Os benchmarks oficiais podem mudar. Consulte o [Meta Business Partner Hub](https://www.facebook.com/business/partner-directory) para os valores vigentes.

---

## Processo de candidatura (visão geral)

1. **Estabilizar Lotes 0-4** — go/no-go sem erros críticos abertos
2. **Acumular histórico de 60-90 dias** em produção com os KPIs acima
3. **Registrar no Meta Business Partner Hub**
   - URL: https://www.facebook.com/business/partner-directory
   - Categoria: "Business Messaging" ou "Customer Experience"
4. **Preencher questionário técnico** — inclui:
   - Volume mensal de mensagens
   - Setores atendidos (saúde, educação etc.)
   - Políticas de privacidade e consentimento (LGPD)
   - Evidências de segurança (HMAC, isolamento multi-tenant, auditoria)
5. **Aguardar review** — processo leva de 4 a 12 semanas
6. **Configurar `META_PARTNER_ID`** no ambiente após aprovação

---

## Checklist de preparação

Execute antes de submeter candidatura:

- [ ] `npm run precheck` — todos os itens `[Meta Partner]` passando
- [ ] `npm run smoke` — 10/10 verificações passando em produção
- [ ] KPIs coletados por pelo menos 60 dias consecutivos
- [ ] Taxa de entrega ≥ 95% no período
- [ ] Zero erro crítico aberto em isolamento multi-tenant
- [ ] Política de privacidade publicada e versionada
- [ ] Processo LGPD documentado e testado (exportação, anonimização, revogação)
- [ ] Runbook de incidentes disponível para a equipe ([LOTE3_RUNBOOK_INCIDENTES.md](./LOTE3_RUNBOOK_INCIDENTES.md))
- [ ] Documentação de onboarding de clientes disponível

---

## Onboarding de novos tenants

Para cada nova clínica integrada, execute:

```bash
BASE_URL=https://api.meusite.com \
ONBOARDING_EMAIL=admin@clinica.com \
ONBOARDING_PASSWORD=senha \
npm run onboarding
```

O script valida: autenticação, organização, templates, membros, LGPD e KPIs.
