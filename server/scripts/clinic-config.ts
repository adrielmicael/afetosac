/**
 * Configura (cifrado) o acesso ao Supabase do Afeto Clinic para uma organização.
 * Roda direto contra o banco do SAC — NÃO mexe no Supabase do Clinic.
 *
 * Uso (PowerShell):
 *   $env:ORG_SLUG="clinica-afeto"
 *   $env:CLINIC_SUPABASE_URL="https://eyaampjyhduydpxuieve.supabase.co"
 *   $env:CLINIC_SUPABASE_KEY="<service_role_key>"
 *   npm run clinic:config
 *
 * Pré-requisitos: DATABASE_URL e ENCRYPTION_KEY no server/.env, e a organização
 * (ORG_SLUG) já existente no banco do SAC.
 */
import dotenv from 'dotenv';
import prisma from '../src/config/database';
import { encrypt, maskSecret } from '../src/utils/crypto';

dotenv.config();

async function main() {
  const slug = process.env.ORG_SLUG;
  const url = process.env.CLINIC_SUPABASE_URL;
  const key = process.env.CLINIC_SUPABASE_KEY;

  if (!slug || !url || !key) {
    throw new Error('Defina ORG_SLUG, CLINIC_SUPABASE_URL e CLINIC_SUPABASE_KEY no ambiente.');
  }
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY ausente (server/.env) — necessária para cifrar a chave.');
  }

  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) {
    throw new Error(`Organização com slug "${slug}" não encontrada no SAC.`);
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      afetoClinicSupabaseUrl: url,
      afetoClinicSupabaseKey: encrypt(key),
      afetoClinicEnabled: true,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`✅ Supabase do Clinic configurado para "${org.name}" (${slug})`);
  console.log(`   URL : ${url}`);
  console.log(`   Key : ${maskSecret(encrypt(key))} (cifrada no cofre)`);
  console.log('   Próximo: npm run clinic:sync  (com DRY_RUN=true para simular)');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('❌', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
