# 🏢 LOTE 9: MULTI-TENANCY (SaaS)
## Separação de dados por organização

---

## 📋 Objetivos

1. **Modelo Organization/Tenant**
   - Criar tabela organizations
   - Criar tabela organization_members (usuários × organizações)
   - Suporte a múltiplas clínicas no mesmo banco

2. **Isolamento de Dados**
   - Todos os dados vinculados a organization_id
   - Row Level Security (RLS) no PostgreSQL
   - Middleware de tenant isolation

3. **Subdomínios/Rotas**
   - Identificação por subdomínio (clinica.afeto.com)
   - Ou header/path de organização

4. **Autenticação Multi-tenant**
   - Usuário pode pertencer a múltiplas orgs
   - Switch entre organizações
   - Convites por email

---

## 🚀 Iniciando implementação!
