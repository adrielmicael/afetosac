-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0d9488',
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "settings" TEXT,
    "whatsappApiUrl" TEXT,
    "whatsappAccessToken" TEXT,
    "whatsappPhoneNumberId" TEXT,
    "whatsappWebhookVerifyToken" TEXT,
    "maxUsers" INTEGER NOT NULL DEFAULT 3,
    "maxChats" INTEGER NOT NULL DEFAULT 100,
    "maxStorageGB" INTEGER NOT NULL DEFAULT 1,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'AGENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorBackupCodes" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "responsible" TEXT,
    "allergies" TEXT,
    "observations" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAnonymized" BOOLEAN NOT NULL DEFAULT false,
    "anonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "therapies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#0d9488',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "therapies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "agentId" TEXT,
    "patientId" TEXT,
    "slaConfigId" TEXT,
    "is24hOpen" BOOLEAN NOT NULL DEFAULT true,
    "windowExpires" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstResponseAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "sender" TEXT NOT NULL DEFAULT 'CLIENT',
    "senderId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "fileName" TEXT,
    "fileSize" TEXT,
    "duration" TEXT,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'SENDING',
    "replyToId" TEXT,
    "buttons" TEXT,
    "whatsappMessageId" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#0d9488',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "therapy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_records" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "professional" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'evolution',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quick_replies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quick_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "variables" TEXT,
    "category" TEXT NOT NULL DEFAULT 'UTILITY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_flows" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggers" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatbot_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_steps" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "fieldName" TEXT,
    "options" TEXT,

    CONSTRAINT "chatbot_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_sessions" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "currentStepId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "data" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "chatbot_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "firstResponseMinutes" INTEGER NOT NULL DEFAULT 15,
    "resolutionMinutes" INTEGER NOT NULL DEFAULT 240,
    "warningThreshold" INTEGER NOT NULL DEFAULT 80,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "privacyVersion" TEXT NOT NULL,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_access_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "patientId" TEXT,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "reason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_export_logs" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "exportedBy" TEXT NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL,

    CONSTRAINT "data_export_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_deletion_logs" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "originalPhone" TEXT NOT NULL,
    "anonymizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,

    CONSTRAINT "data_deletion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lgpd_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "protocol" TEXT NOT NULL,
    "notes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "respondedBy" TEXT,
    "ipAddress" TEXT NOT NULL DEFAULT 'unknown',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lgpd_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceName" TEXT,
    "deviceType" TEXT,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "location" TEXT,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "status" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "location" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cache" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "job_queue" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "job_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PatientToTherapy" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ChatToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_domain_key" ON "organizations"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripeCustomerId_key" ON "organizations"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripeSubscriptionId_key" ON "organizations"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "organizations"("status");

-- CreateIndex
CREATE INDEX "organizations_plan_idx" ON "organizations"("plan");

-- CreateIndex
CREATE INDEX "organization_members_organizationId_idx" ON "organization_members"("organizationId");

-- CreateIndex
CREATE INDEX "organization_members_userId_idx" ON "organization_members"("userId");

-- CreateIndex
CREATE INDEX "organization_members_role_idx" ON "organization_members"("role");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE INDEX "users_twoFactorEnabled_idx" ON "users"("twoFactorEnabled");

-- CreateIndex
CREATE INDEX "patients_organizationId_idx" ON "patients"("organizationId");

-- CreateIndex
CREATE INDEX "patients_name_idx" ON "patients"("name");

-- CreateIndex
CREATE INDEX "patients_isActive_idx" ON "patients"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "patients_organizationId_phone_key" ON "patients"("organizationId", "phone");

-- CreateIndex
CREATE INDEX "therapies_organizationId_idx" ON "therapies"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "therapies_organizationId_name_key" ON "therapies"("organizationId", "name");

-- CreateIndex
CREATE INDEX "chats_organizationId_idx" ON "chats"("organizationId");

-- CreateIndex
CREATE INDEX "chats_organizationId_phone_idx" ON "chats"("organizationId", "phone");

-- CreateIndex
CREATE INDEX "chats_organizationId_status_idx" ON "chats"("organizationId", "status");

-- CreateIndex
CREATE INDEX "chats_organizationId_agentId_idx" ON "chats"("organizationId", "agentId");

-- CreateIndex
CREATE INDEX "chats_organizationId_lastMessageAt_idx" ON "chats"("organizationId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "messages_whatsappMessageId_key" ON "messages"("whatsappMessageId");

-- CreateIndex
CREATE INDEX "messages_chatId_createdAt_idx" ON "messages"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_sender_idx" ON "messages"("sender");

-- CreateIndex
CREATE INDEX "messages_status_idx" ON "messages"("status");

-- CreateIndex
CREATE INDEX "tags_organizationId_idx" ON "tags"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_organizationId_label_key" ON "tags"("organizationId", "label");

-- CreateIndex
CREATE INDEX "appointments_patientId_idx" ON "appointments"("patientId");

-- CreateIndex
CREATE INDEX "appointments_date_idx" ON "appointments"("date");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE INDEX "appointments_createdBy_idx" ON "appointments"("createdBy");

-- CreateIndex
CREATE INDEX "medical_records_patientId_idx" ON "medical_records"("patientId");

-- CreateIndex
CREATE INDEX "medical_records_date_idx" ON "medical_records"("date");

-- CreateIndex
CREATE INDEX "medical_records_createdBy_idx" ON "medical_records"("createdBy");

-- CreateIndex
CREATE INDEX "quick_replies_organizationId_idx" ON "quick_replies"("organizationId");

-- CreateIndex
CREATE INDEX "quick_replies_category_idx" ON "quick_replies"("category");

-- CreateIndex
CREATE UNIQUE INDEX "quick_replies_organizationId_title_key" ON "quick_replies"("organizationId", "title");

-- CreateIndex
CREATE INDEX "templates_organizationId_idx" ON "templates"("organizationId");

-- CreateIndex
CREATE INDEX "templates_category_idx" ON "templates"("category");

-- CreateIndex
CREATE UNIQUE INDEX "templates_organizationId_name_key" ON "templates"("organizationId", "name");

-- CreateIndex
CREATE INDEX "activities_organizationId_idx" ON "activities"("organizationId");

-- CreateIndex
CREATE INDEX "activities_userId_idx" ON "activities"("userId");

-- CreateIndex
CREATE INDEX "activities_type_idx" ON "activities"("type");

-- CreateIndex
CREATE INDEX "activities_createdAt_idx" ON "activities"("createdAt");

-- CreateIndex
CREATE INDEX "chatbot_flows_organizationId_idx" ON "chatbot_flows"("organizationId");

-- CreateIndex
CREATE INDEX "chatbot_flows_isActive_idx" ON "chatbot_flows"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "chatbot_flows_organizationId_name_key" ON "chatbot_flows"("organizationId", "name");

-- CreateIndex
CREATE INDEX "chatbot_steps_flowId_idx" ON "chatbot_steps"("flowId");

-- CreateIndex
CREATE INDEX "chatbot_steps_order_idx" ON "chatbot_steps"("order");

-- CreateIndex
CREATE INDEX "chatbot_sessions_chatId_idx" ON "chatbot_sessions"("chatId");

-- CreateIndex
CREATE INDEX "chatbot_sessions_flowId_idx" ON "chatbot_sessions"("flowId");

-- CreateIndex
CREATE INDEX "chatbot_sessions_status_idx" ON "chatbot_sessions"("status");

-- CreateIndex
CREATE INDEX "sla_configs_organizationId_idx" ON "sla_configs"("organizationId");

-- CreateIndex
CREATE INDEX "sla_configs_isDefault_idx" ON "sla_configs"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "sla_configs_organizationId_name_key" ON "sla_configs"("organizationId", "name");

-- CreateIndex
CREATE INDEX "consents_patientId_idx" ON "consents"("patientId");

-- CreateIndex
CREATE INDEX "consents_type_idx" ON "consents"("type");

-- CreateIndex
CREATE INDEX "consents_granted_idx" ON "consents"("granted");

-- CreateIndex
CREATE INDEX "data_access_logs_userId_idx" ON "data_access_logs"("userId");

-- CreateIndex
CREATE INDEX "data_access_logs_patientId_idx" ON "data_access_logs"("patientId");

-- CreateIndex
CREATE INDEX "data_access_logs_timestamp_idx" ON "data_access_logs"("timestamp");

-- CreateIndex
CREATE INDEX "data_export_logs_patientId_idx" ON "data_export_logs"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "data_deletion_logs_patientId_key" ON "data_deletion_logs"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "data_deletion_logs_certificateId_key" ON "data_deletion_logs"("certificateId");

-- CreateIndex
CREATE INDEX "data_deletion_logs_certificateId_idx" ON "data_deletion_logs"("certificateId");

-- CreateIndex
CREATE UNIQUE INDEX "lgpd_requests_protocol_key" ON "lgpd_requests"("protocol");

-- CreateIndex
CREATE INDEX "lgpd_requests_organizationId_idx" ON "lgpd_requests"("organizationId");

-- CreateIndex
CREATE INDEX "lgpd_requests_patientId_idx" ON "lgpd_requests"("patientId");

-- CreateIndex
CREATE INDEX "lgpd_requests_status_idx" ON "lgpd_requests"("status");

-- CreateIndex
CREATE INDEX "lgpd_requests_protocol_idx" ON "lgpd_requests"("protocol");

-- CreateIndex
CREATE INDEX "lgpd_requests_requestedAt_idx" ON "lgpd_requests"("requestedAt");

-- CreateIndex
CREATE INDEX "settings_organizationId_idx" ON "settings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_organizationId_key_key" ON "settings"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "device_sessions_token_key" ON "device_sessions"("token");

-- CreateIndex
CREATE INDEX "device_sessions_userId_idx" ON "device_sessions"("userId");

-- CreateIndex
CREATE INDEX "device_sessions_token_idx" ON "device_sessions"("token");

-- CreateIndex
CREATE INDEX "device_sessions_isValid_idx" ON "device_sessions"("isValid");

-- CreateIndex
CREATE INDEX "device_sessions_expiresAt_idx" ON "device_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "login_history_userId_idx" ON "login_history"("userId");

-- CreateIndex
CREATE INDEX "login_history_organizationId_idx" ON "login_history"("organizationId");

-- CreateIndex
CREATE INDEX "login_history_status_idx" ON "login_history"("status");

-- CreateIndex
CREATE INDEX "login_history_createdAt_idx" ON "login_history"("createdAt");

-- CreateIndex
CREATE INDEX "cache_expiresAt_idx" ON "cache"("expiresAt");

-- CreateIndex
CREATE INDEX "job_queue_queue_idx" ON "job_queue"("queue");

-- CreateIndex
CREATE INDEX "job_queue_status_idx" ON "job_queue"("status");

-- CreateIndex
CREATE INDEX "job_queue_createdAt_idx" ON "job_queue"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_PatientToTherapy_AB_unique" ON "_PatientToTherapy"("A", "B");

-- CreateIndex
CREATE INDEX "_PatientToTherapy_B_index" ON "_PatientToTherapy"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ChatToTag_AB_unique" ON "_ChatToTag"("A", "B");

-- CreateIndex
CREATE INDEX "_ChatToTag_B_index" ON "_ChatToTag"("B");

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "therapies" ADD CONSTRAINT "therapies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_slaConfigId_fkey" FOREIGN KEY ("slaConfigId") REFERENCES "sla_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quick_replies" ADD CONSTRAINT "quick_replies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_flows" ADD CONSTRAINT "chatbot_flows_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_steps" ADD CONSTRAINT "chatbot_steps_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "chatbot_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_sessions" ADD CONSTRAINT "chatbot_sessions_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_sessions" ADD CONSTRAINT "chatbot_sessions_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "chatbot_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_sessions" ADD CONSTRAINT "chatbot_sessions_currentStepId_fkey" FOREIGN KEY ("currentStepId") REFERENCES "chatbot_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_configs" ADD CONSTRAINT "sla_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_access_logs" ADD CONSTRAINT "data_access_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_access_logs" ADD CONSTRAINT "data_access_logs_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_export_logs" ADD CONSTRAINT "data_export_logs_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_deletion_logs" ADD CONSTRAINT "data_deletion_logs_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lgpd_requests" ADD CONSTRAINT "lgpd_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lgpd_requests" ADD CONSTRAINT "lgpd_requests_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PatientToTherapy" ADD CONSTRAINT "_PatientToTherapy_A_fkey" FOREIGN KEY ("A") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PatientToTherapy" ADD CONSTRAINT "_PatientToTherapy_B_fkey" FOREIGN KEY ("B") REFERENCES "therapies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChatToTag" ADD CONSTRAINT "_ChatToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ChatToTag" ADD CONSTRAINT "_ChatToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
