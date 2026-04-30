# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências de build
RUN apk add --no-cache python3 make g++

# Copiar package files
COPY package*.json ./
COPY prisma ./prisma

# Instalar dependências
RUN npm ci

# Gerar Prisma Client
RUN npx prisma generate

# Copiar código fonte
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Instalar curl para healthcheck
RUN apk add --no-cache curl

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copiar package files
COPY package*.json ./
COPY prisma ./prisma

# Instalar apenas dependências de produção
RUN npm ci --only=production && npm cache clean --force

# Gerar Prisma Client
RUN npx prisma generate

# Copiar build do stage anterior
COPY --from=builder /app/dist ./dist

# Mudar ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expor porta
EXPOSE 3001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Comando de start
CMD ["node", "dist/index.js"]
