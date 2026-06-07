-- Lote 7: integração Afeto Clinic (mapa de tenant + SSO/provisionamento)

ALTER TABLE "organizations" ADD COLUMN "externalId" TEXT;
ALTER TABLE "organizations" ADD COLUMN "afetoClinicSecret" TEXT;
ALTER TABLE "organizations" ADD COLUMN "afetoClinicEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "organizations_externalId_key" ON "organizations"("externalId");
