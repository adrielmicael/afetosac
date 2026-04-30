# Afeto SAC - Sistema de Atendimento para Clínicas

Sistema completo de SAC (Serviço de Atendimento ao Cliente) para clínicas de saúde, com integração nativa ao WhatsApp Business API.

## Funcionalidades

### Core
- Autenticação JWT com controle de acesso (Admin, Agente, Supervisor)
- Chat em tempo real via WebSocket
- Gestão de pacientes e prontuários
- Agendamento e confirmação de consultas
- Templates de mensagens (HSM)
- Respostas rápidas
- Notas internas (sussurros)

### Canais de Comunicação
- WhatsApp Business API (Meta)
- Instagram (em desenvolvimento)
- Facebook Messenger (em desenvolvimento)

### Integrações
- Afeto Clinic (sistema de gestão de clínicas)
- WhatsApp Business API

## Tecnologias

### Backend
- Node.js + Express
- TypeScript
- Prisma ORM + SQLite
- Socket.io
- JWT Authentication
- Winston Logger

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand (State Management)
- React Query (Data Fetching)
- React Hook Form + Zod

## Instalação

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Passo a passo

1. Clone o repositório e entre na pasta
```bash
cd "Afeto SAC"
```

2. Instale as dependências
```bash
npm run install:all
```

3. Configure o ambiente do servidor
```bash
cd server
copy env-example.txt .env
```

Edite o arquivo `.env` com suas configurações:
```env
PORT=3001
DATABASE_URL="file:./dev.db"
JWT_SECRET="sua-chave-secreta-aqui"

# WhatsApp Business API
WHATSAPP_ACCESS_TOKEN="seu-token-aqui"
WHATSAPP_PHONE_NUMBER_ID="seu-phone-number-id"
WHATSAPP_WEBHOOK_VERIFY_TOKEN="seu-verify-token"
```

4. Execute as migrações do banco de dados
```bash
npm run db:migrate
```

5. Popule o banco com dados iniciais
```bash
npm run db:seed
```

6. Inicie o servidor em modo desenvolvimento
```bash
npm run dev
```

O servidor estará rodando em `http://localhost:3001`

7. Em outro terminal, inicie o cliente
```bash
cd client
npm run dev
```

O frontend estará disponível em `http://localhost:5173`

## Credenciais de Demonstração

- **Admin**: admin@afeto.com / admin123
- **Agente**: agent@afeto.com / agent123

## Estrutura do Projeto

```
Afeto SAC/
├── server/                 # Backend Node.js
│   ├── src/
│   │   ├── config/        # Configurações
│   │   ├── controllers/   # Controllers
│   │   ├── middleware/    # Middlewares
│   │   ├── routes/        # Rotas
│   │   ├── services/      # Serviços
│   │   ├── types/         # Tipos TypeScript
│   │   └── utils/         # Utilitários
│   ├── prisma/
│   │   └── schema.prisma  # Schema do banco
│   └── package.json
│
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/    # Componentes
│   │   ├── hooks/         # Hooks customizados
│   │   ├── pages/         # Páginas
│   │   ├── services/      # API services
│   │   ├── store/         # Zustand stores
│   │   └── types/         # Tipos TypeScript
│   └── package.json
│
└── package.json           # Scripts do projeto
```

## Scripts Disponíveis

### Root
- `npm run install:all` - Instala todas as dependências
- `npm run dev` - Inicia servidor e cliente simultaneamente

### Server
- `npm run dev` - Inicia em modo desenvolvimento
- `npm run build` - Compila TypeScript
- `npm start` - Inicia em produção
- `npm run db:migrate` - Executa migrações
- `npm run db:seed` - Popula banco de dados
- `npm run db:studio` - Abre Prisma Studio

### Client
- `npm run dev` - Inicia servidor de desenvolvimento
- `npm run build` - Compila para produção
- `npm run preview` - Preview da build

## Configuração WhatsApp Business API

1. Crie uma conta em [developers.facebook.com](https://developers.facebook.com)
2. Crie um app do tipo "Business"
3. Adicione o produto "WhatsApp"
4. Configure um número de telefone
5. Copie o Access Token e Phone Number ID para o `.env`
6. Configure o webhook apontando para `https://seu-dominio.com/api/webhooks/whatsapp`

## Variáveis de Ambiente

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| PORT | Porta do servidor | Não (padrão: 3001) |
| DATABASE_URL | URL do banco SQLite | Sim |
| JWT_SECRET | Chave secreta JWT | Sim |
| JWT_EXPIRES_IN | Tempo de expiração do token | Não (padrão: 7d) |
| WHATSAPP_ACCESS_TOKEN | Token da API do WhatsApp | Para WhatsApp |
| WHATSAPP_PHONE_NUMBER_ID | ID do número de telefone | Para WhatsApp |
| WHATSAPP_WEBHOOK_VERIFY_TOKEN | Token de verificação do webhook | Para WhatsApp |

## Licença

MIT

## Suporte

Para suporte, entre em contato com a equipe Afeto.
