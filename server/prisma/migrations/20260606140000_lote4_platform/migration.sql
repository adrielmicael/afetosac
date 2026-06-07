-- Lote 4: camada de plataforma SaaS (super-admin acima dos tenants)

CREATE TABLE "platform_admins" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'SUPPORT',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
  "twoFactorSecret" TEXT,
  "twoFactorBackupCodes" TEXT,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");
CREATE INDEX "platform_admins_email_idx" ON "platform_admins"("email");
CREATE INDEX "platform_admins_role_idx" ON "platform_admins"("role");

CREATE TABLE "platform_sessions" (
  "id" TEXT NOT NULL,
  "platformAdminId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "ipAddress" TEXT NOT NULL,
  "userAgent" TEXT NOT NULL,
  "isValid" BOOLEAN NOT NULL DEFAULT true,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "platform_sessions_token_key" ON "platform_sessions"("token");
CREATE INDEX "platform_sessions_platformAdminId_idx" ON "platform_sessions"("platformAdminId");
CREATE INDEX "platform_sessions_token_idx" ON "platform_sessions"("token");
CREATE INDEX "platform_sessions_isValid_idx" ON "platform_sessions"("isValid");
ALTER TABLE "platform_sessions" ADD CONSTRAINT "platform_sessions_platformAdminId_fkey"
  FOREIGN KEY ("platformAdminId") REFERENCES "platform_admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "platform_audit_logs" (
  "id" TEXT NOT NULL,
  "platformAdminId" TEXT,
  "actorEmail" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "organizationId" TEXT,
  "before" TEXT,
  "after" TEXT,
  "ipAddress" TEXT NOT NULL,
  "userAgent" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "platform_audit_logs_platformAdminId_idx" ON "platform_audit_logs"("platformAdminId");
CREATE INDEX "platform_audit_logs_action_idx" ON "platform_audit_logs"("action");
CREATE INDEX "platform_audit_logs_organizationId_idx" ON "platform_audit_logs"("organizationId");
CREATE INDEX "platform_audit_logs_createdAt_idx" ON "platform_audit_logs"("createdAt");
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_platformAdminId_fkey"
  FOREIGN KEY ("platformAdminId") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "usage_metrics" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "messagesIn" INTEGER NOT NULL DEFAULT 0,
  "messagesOut" INTEGER NOT NULL DEFAULT 0,
  "activeUsers" INTEGER NOT NULL DEFAULT 0,
  "chatsTotal" INTEGER NOT NULL DEFAULT 0,
  "patientsTotal" INTEGER NOT NULL DEFAULT 0,
  "storageMb" INTEGER NOT NULL DEFAULT 0,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_metrics_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "usage_metrics_organizationId_period_key" ON "usage_metrics"("organizationId", "period");
CREATE INDEX "usage_metrics_organizationId_idx" ON "usage_metrics"("organizationId");
CREATE INDEX "usage_metrics_period_idx" ON "usage_metrics"("period");
ALTER TABLE "usage_metrics" ADD CONSTRAINT "usage_metrics_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
