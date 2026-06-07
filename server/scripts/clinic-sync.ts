/**
 * Testa a conexão e sincroniza pacientes do Supabase do Afeto Clinic para o SAC.
 * SOMENTE LEITURA no Clinic (só SELECT). As escritas ocorrem no banco do SAC.
 *
 * Uso (PowerShell):
 *   $env:ORG_SLUG="clinica-afeto"
 *   $env:DRY_RUN="true"     # simula: lê e conta, mas NÃO grava (recomendado 1º)
 *   npm run clinic:sync
 *
 *   # quando estiver confiante, rode sem DRY_RUN para importar de verdade:
 *   $env:DRY_RUN="false"; npm run clinic:sync
 *
 * Opcional: $env:CLINIC_TABLE="patients" (default).
 */
import dotenv from 'dotenv';
import prisma from '../src/config/database';
import { testClinicConnection, syncPatientsFromClinic } from '../src/services/clinicSupabaseService';

dotenv.config();

async function main() {
  const slug = process.env.ORG_SLUG;
  const table = process.env.CLINIC_TABLE || 'patients';
  const dryRun = process.env.DRY_RUN !== 'false'; // padrão seguro: simula

  if (!slug) throw new Error('Defina ORG_SLUG no ambiente.');

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!org) throw new Error(`Organização com slug "${slug}" não encontrada no SAC.`);

  // eslint-disable-next-line no-console
  console.log(`🔌 Testando conexão (tabela "${table}")...`);
  const test = await testClinicConnection(org.id, table);
  console.log(`   colunas detectadas: ${test.columns.join(', ') || '(sem linhas para amostrar)'}`);
  console.log(`   total na origem   : ${test.rowCount ?? 'desconhecido'}`);

  console.log(dryRun ? '🧪 SIMULAÇÃO (dry-run): nada será gravado no SAC...' : '⬇️  Importando para o SAC...');
  const result = await syncPatientsFromClinic(org.id, table, { dryRun });

  console.log('   resultado:', JSON.stringify(result));
  if (dryRun) {
    console.log('   ↳ Para importar de verdade: $env:DRY_RUN="false"; npm run clinic:sync');
  } else {
    console.log(`   ✅ ${result.upserted} pacientes importados/atualizados.`);
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('❌', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
