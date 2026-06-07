-- Lote 7: leitura/sync via Supabase REST do Afeto Clinic (por tenant)

ALTER TABLE "organizations" ADD COLUMN "afetoClinicSupabaseUrl" TEXT;
ALTER TABLE "organizations" ADD COLUMN "afetoClinicSupabaseKey" TEXT;
