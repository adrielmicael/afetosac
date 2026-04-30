-- Lote 2: persistir templateId em mensagens outbound
ALTER TABLE "messages"
ADD COLUMN "templateId" TEXT;

CREATE INDEX "messages_templateId_idx" ON "messages"("templateId");
