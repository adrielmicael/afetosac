import { createClient, SupabaseClient } from '@supabase/supabase-js';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { decrypt } from '../utils/crypto';
import { logger } from '../utils/logger';

/**
 * Monta um cliente Supabase REST com as credenciais da organização (URL + key
 * decifrada). Retorna null se a integração de leitura não estiver configurada.
 * É assim que o sistema "acessa" o Supabase do Afeto Clinic em runtime, por
 * tenant, sem credenciais globais.
 */
export const getClinicSupabaseClient = async (
  organizationId: string
): Promise<SupabaseClient | null> => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { afetoClinicSupabaseUrl: true, afetoClinicSupabaseKey: true },
  });

  if (!org?.afetoClinicSupabaseUrl || !org.afetoClinicSupabaseKey) {
    return null;
  }

  const key = decrypt(org.afetoClinicSupabaseKey);
  if (!key) return null;

  return createClient(org.afetoClinicSupabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

/**
 * Testa a conexão lendo 1 linha da tabela informada (default 'patients').
 * Retorna as colunas detectadas — útil para mapear o schema do Clinic.
 */
export const testClinicConnection = async (
  organizationId: string,
  table = 'patients'
): Promise<{ ok: boolean; columns: string[]; rowCount: number | null }> => {
  const supa = await getClinicSupabaseClient(organizationId);
  if (!supa) {
    throw new AppError('Integração Supabase do Afeto Clinic não configurada', 400);
  }

  const { data, error, count } = await supa
    .from(table)
    .select('*', { count: 'exact' })
    .limit(1);

  if (error) {
    throw new AppError(`Falha ao acessar o Supabase do Clinic: ${error.message}`, 502);
  }

  return {
    ok: true,
    columns: data && data[0] ? Object.keys(data[0]) : [],
    rowCount: count ?? null,
  };
};

// Aceita variações comuns de nomes de coluna (pt/en) do Afeto Clinic
const pick = (row: Record<string, any>, keys: string[]): string | null => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return String(row[k]);
  }
  return null;
};

/**
 * Sincroniza pacientes do Supabase do Clinic para o SAC (upsert por org+phone).
 * Mapeamento tolerante a nomes pt/en; ajuste fino conforme o schema real.
 *
 * Esta função é SOMENTE LEITURA no Clinic: apenas faz SELECT. As escritas
 * ocorrem exclusivamente no banco do SAC (prisma.patient.upsert).
 *
 * @param opts.dryRun quando true, lê e conta mas NÃO grava nada no SAC.
 */
// Colunas que o sync realmente usa (em ordem de preferência pt/en).
// Só estas são lidas — dados sensíveis (cpf, senha, prontuário) nem trafegam.
const SYNC_CANDIDATE_COLUMNS = [
  'id', // identidade do paciente no Afeto Clinic
  'phone', 'telefone', 'celular', 'whatsapp',
  'name', 'nome', 'full_name',
  'email', 'e_mail',
  'responsible', 'responsavel', 'guardian',
  'age', 'idade',
];

const TENANT_COLUMN = 'tenant_id';

export const syncPatientsFromClinic = async (
  organizationId: string,
  table = 'patients',
  opts: { dryRun?: boolean } = {}
): Promise<{ total: number; eligible: number; upserted: number; contacts: number; skipped: number; dryRun: boolean; tenantFiltered: boolean }> => {
  const supa = await getClinicSupabaseClient(organizationId);
  if (!supa) {
    throw new AppError('Integração Supabase do Afeto Clinic não configurada', 400);
  }

  const dryRun = Boolean(opts.dryRun);

  // externalId do SAC = tenant_id da clínica no Afeto Clinic (escopo do sync)
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { externalId: true },
  });

  // Descobre as colunas reais (1 linha) para montar uma projeção MÍNIMA
  const probe = await supa.from(table).select('*').limit(1);
  if (probe.error) {
    throw new AppError(`Falha ao acessar o Clinic: ${probe.error.message}`, 502);
  }
  const available: string[] = probe.data && probe.data[0] ? Object.keys(probe.data[0]) : [];
  const hasTenantColumn = available.includes(TENANT_COLUMN);

  // 🔒 Segurança multi-tenant: tabela com tenant_id exige externalId definido,
  // senão a service_role traria pacientes de TODAS as clínicas.
  if (hasTenantColumn && !org?.externalId) {
    throw new AppError(
      'A tabela é multi-clínica (tenant_id), mas esta organização não tem o tenant do Afeto Clinic (externalId) configurado. ' +
        'Defina o externalId antes de sincronizar para não misturar dados de outras clínicas.',
      400
    );
  }
  const tenantId = hasTenantColumn ? org!.externalId : null;

  // Projeção mínima: só as colunas mapeadas que existem (evita trafegar cpf/senha)
  const projection = SYNC_CANDIDATE_COLUMNS.filter((c) => available.includes(c));
  const selectCols = projection.length > 0 ? projection.join(',') : '*';

  // PostgREST limita a 1000 linhas por requisição — paginamos para trazer TODOS
  // os registros já existentes, não apenas a primeira página.
  const pageSize = 1000;
  let from = 0;
  let total = 0;
  let eligible = 0;
  let upserted = 0;
  let skipped = 0;
  const contactPhones = new Set<string>();

  for (;;) {
    let query = supa.from(table).select(selectCols);
    if (tenantId) query = query.eq(TENANT_COLUMN, tenantId);
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) {
      throw new AppError(`Falha ao ler pacientes do Clinic: ${error.message}`, 502);
    }

    const rows = data || [];
    total += rows.length;

    for (const row of rows) {
      const phone = pick(row, ['phone', 'telefone', 'celular', 'whatsapp']);
      const externalId = pick(row, ['id']);
      // Sem telefone (conversa) ou sem id (identidade) não dá para sincronizar
      if (!phone || !externalId) {
        skipped += 1;
        continue;
      }
      eligible += 1;
      contactPhones.add(phone);

      if (dryRun) continue; // simulação: não grava no SAC

      const name = pick(row, ['name', 'nome', 'full_name']) || 'Sem nome';
      const email = pick(row, ['email', 'e_mail']);
      const responsible = pick(row, ['responsible', 'responsavel', 'guardian']);
      const age = pick(row, ['age', 'idade']);

      // 1) Contato (dono do telefone) — agrupa pacientes que compartilham o número
      const contact = await prisma.contact.upsert({
        where: { organizationId_phone: { organizationId, phone } },
        update: { name: responsible || name },
        create: { organizationId, phone, name: responsible || name },
        select: { id: true },
      });

      // 2) Paciente — identidade pelo id do Clinic (não pelo telefone)
      await prisma.patient.upsert({
        where: { organizationId_externalId: { organizationId, externalId } },
        update: { name, email, responsible, age, phone, contactId: contact.id, isActive: true },
        create: { organizationId, externalId, name, phone, email, responsible, age, contactId: contact.id },
      });
      upserted += 1;
    }

    if (rows.length < pageSize) break; // última página
    from += pageSize;
  }

  logger.info(
    `Clinic sync${dryRun ? ' (dry-run)' : ''}: ${total} lidos, ${eligible} elegíveis, ${upserted} pacientes, ${contactPhones.size} contatos, ${skipped} ignorados, tenant=${tenantId ?? 'TODOS'} (org ${organizationId})`
  );
  return {
    total,
    eligible,
    upserted,
    contacts: contactPhones.size,
    skipped,
    dryRun,
    tenantFiltered: Boolean(tenantId),
  };
};
