import { createClient, SupabaseClient } from '@supabase/supabase-js';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * Credenciais do Supabase do Afeto Clinic são GLOBAIS (nível desenvolvedor):
 * um único banco compartilhado por todas as clínicas, separadas por tenant_id.
 * A clínica nunca vê/define URL ou service_role — só informa o seu tenant.
 */
const clinicUrl = () =>
  process.env.AFETO_CLINIC_SUPABASE_URL || process.env.CLINIC_SUPABASE_URL || '';
const clinicKey = () =>
  process.env.AFETO_CLINIC_SUPABASE_KEY || process.env.CLINIC_SUPABASE_KEY || '';

/** Indica se o desenvolvedor configurou a integração na plataforma. */
export const isClinicIntegrationAvailable = (): boolean =>
  Boolean(clinicUrl() && clinicKey());

/** Cliente Supabase REST com as credenciais GLOBAIS do Afeto Clinic. */
export const getClinicSupabaseClient = (): SupabaseClient | null => {
  const url = clinicUrl();
  const key = clinicKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

const TENANT_COLUMN = 'tenant_id';

// Resolve o cliente global + o tenant (externalId) da organização.
const resolveClientAndTenant = async (organizationId: string) => {
  const supa = getClinicSupabaseClient();
  if (!supa) {
    throw new AppError(
      'Integração Afeto Clinic não configurada na plataforma. Contate o suporte.',
      400
    );
  }
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { externalId: true },
  });
  return { supa, externalId: org?.externalId || null };
};

/**
 * Testa a conexão e conta os registros DO TENANT da clínica.
 */
export const testClinicConnection = async (
  organizationId: string,
  table = 'patients'
): Promise<{ ok: boolean; columns: string[]; rowCount: number | null }> => {
  const { supa, externalId } = await resolveClientAndTenant(organizationId);

  // Descobre colunas + se a tabela é multi-tenant
  const probe = await supa.from(table).select('*').limit(1);
  if (probe.error) {
    throw new AppError(`Falha ao acessar o Afeto Clinic: ${probe.error.message}`, 502);
  }
  const columns = probe.data && probe.data[0] ? Object.keys(probe.data[0]) : [];
  const hasTenant = columns.includes(TENANT_COLUMN);

  if (hasTenant && !externalId) {
    throw new AppError('Informe o tenant da clínica antes de testar.', 400);
  }

  let query = supa.from(table).select('*', { count: 'exact' });
  if (hasTenant && externalId) query = query.eq(TENANT_COLUMN, externalId);
  const { error, count } = await query.limit(1);
  if (error) {
    throw new AppError(`Falha ao acessar o Afeto Clinic: ${error.message}`, 502);
  }

  return { ok: true, columns, rowCount: count ?? null };
};

const pick = (row: Record<string, any>, keys: string[]): string | null => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== '') return String(row[k]);
  }
  return null;
};

/**
 * Sincroniza pacientes do tenant da clínica para o SAC.
 * SOMENTE LEITURA no Clinic; escreve apenas no SAC (Contact + Patient).
 */
export const syncPatientsFromClinic = async (
  organizationId: string,
  table = 'patients',
  opts: { dryRun?: boolean } = {}
): Promise<{ total: number; eligible: number; upserted: number; contacts: number; skipped: number; dryRun: boolean; tenantFiltered: boolean }> => {
  const { supa, externalId } = await resolveClientAndTenant(organizationId);
  const dryRun = Boolean(opts.dryRun);

  // Descobre colunas reais p/ projeção mínima e detecção de tenant
  const probe = await supa.from(table).select('*').limit(1);
  if (probe.error) {
    throw new AppError(`Falha ao acessar o Afeto Clinic: ${probe.error.message}`, 502);
  }
  const available: string[] = probe.data && probe.data[0] ? Object.keys(probe.data[0]) : [];
  const hasTenant = available.includes(TENANT_COLUMN);

  if (hasTenant && !externalId) {
    throw new AppError(
      'A base é multi-clínica (tenant_id), mas o tenant desta clínica não está definido. ' +
        'Informe o tenant do Afeto Clinic antes de sincronizar.',
      400
    );
  }
  const tenantId = hasTenant ? externalId : null;

  // Lê só as colunas necessárias (cpf/senha/saúde nem trafegam)
  const candidates = [
    'id', 'phone', 'telefone', 'celular', 'whatsapp',
    'name', 'nome', 'full_name', 'email', 'e_mail',
    'responsible', 'responsavel', 'guardian', 'age', 'idade',
  ];
  const projection = candidates.filter((c) => available.includes(c));
  const selectCols = projection.length > 0 ? projection.join(',') : '*';

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
      throw new AppError(`Falha ao ler pacientes do Afeto Clinic: ${error.message}`, 502);
    }

    const rows = data || [];
    total += rows.length;

    for (const row of rows) {
      const phone = pick(row, ['phone', 'telefone', 'celular', 'whatsapp']);
      const externalPatientId = pick(row, ['id']);
      if (!phone || !externalPatientId) {
        skipped += 1;
        continue;
      }
      eligible += 1;
      contactPhones.add(phone);

      if (dryRun) continue;

      const name = pick(row, ['name', 'nome', 'full_name']) || 'Sem nome';
      const email = pick(row, ['email', 'e_mail']);
      const responsible = pick(row, ['responsible', 'responsavel', 'guardian']);
      const age = pick(row, ['age', 'idade']);

      const contact = await prisma.contact.upsert({
        where: { organizationId_phone: { organizationId, phone } },
        update: { name: responsible || name },
        create: { organizationId, phone, name: responsible || name },
        select: { id: true },
      });

      await prisma.patient.upsert({
        where: { organizationId_externalId: { organizationId, externalId: externalPatientId } },
        update: { name, email, responsible, age, phone, contactId: contact.id, isActive: true },
        create: { organizationId, externalId: externalPatientId, name, phone, email, responsible, age, contactId: contact.id },
      });
      upserted += 1;
    }

    if (rows.length < pageSize) break;
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
