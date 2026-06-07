-- Lote 2: cofre de credenciais WhatsApp por organização + saúde da conexão

ALTER TABLE "organizations" ADD COLUMN "whatsappAppSecret" TEXT;
ALTER TABLE "organizations" ADD COLUMN "whatsappStatus" TEXT;
ALTER TABLE "organizations" ADD COLUMN "whatsappLastError" TEXT;
ALTER TABLE "organizations" ADD COLUMN "whatsappLastCheckedAt" TIMESTAMP(3);
