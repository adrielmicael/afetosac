process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

import { testClinicConnection, syncPatientsFromClinic } from '../../../src/services/clinicSupabaseService';
import { encrypt } from '../../../src/utils/crypto';
import { prismaMock } from '../../setup';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

const mockCreateClient = createClient as jest.Mock;

const makeSupa = (rows: any[], count = rows.length, error: any = null) => {
  const builder: any = {
    _rows: rows,
    select: jest.fn(function (this: any) {
      return this;
    }),
    eq: jest.fn(function (this: any) {
      return this;
    }),
    limit: jest.fn(function (this: any) {
      return Promise.resolve({ data: this._rows.slice(0, 1), count, error });
    }),
    range: jest.fn(function (this: any, from: number, to: number) {
      return Promise.resolve({ data: this._rows.slice(from, to + 1), count, error });
    }),
  };
  return { from: jest.fn(() => builder), _builder: builder };
};

const orgConfig = (externalId: string | null = null) => ({
  afetoClinicSupabaseUrl: 'https://x.supabase.co',
  afetoClinicSupabaseKey: encrypt('the-key'),
  externalId,
});

describe('clinicSupabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.organization.findUnique.mockResolvedValue(orgConfig() as any);
    prismaMock.contact.upsert.mockResolvedValue({ id: 'contact1' } as any);
    prismaMock.patient.upsert.mockResolvedValue({ id: 'p1' } as any);
  });

  it('testa a conexão e retorna colunas detectadas', async () => {
    mockCreateClient.mockReturnValue(makeSupa([{ id: 1, nome: 'Ana', telefone: '5511' }]));

    const result = await testClinicConnection('org1', 'patients');

    expect(mockCreateClient).toHaveBeenCalledWith('https://x.supabase.co', 'the-key', expect.any(Object));
    expect(result.ok).toBe(true);
    expect(result.columns).toEqual(expect.arrayContaining(['nome', 'telefone']));
  });

  it('sincroniza (sem tenant_id): cria contato + paciente, ignora sem id/telefone', async () => {
    mockCreateClient.mockReturnValue(
      makeSupa([
        { id: 'cli-1', nome: 'Ana', telefone: '5511999', email: 'ana@x.com' },
        { nome: 'Sem id/fone' },
      ])
    );

    const result = await syncPatientsFromClinic('org1', 'patients');

    expect(result).toMatchObject({ total: 2, eligible: 1, upserted: 1, contacts: 1, skipped: 1, tenantFiltered: false });
    expect(prismaMock.contact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId_phone: { organizationId: 'org1', phone: '5511999' } } })
    );
    expect(prismaMock.patient.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_externalId: { organizationId: 'org1', externalId: 'cli-1' } },
        create: expect.objectContaining({ name: 'Ana', phone: '5511999', contactId: 'contact1' }),
      })
    );
  });

  it('dry-run conta contatos e pacientes mas NÃO grava', async () => {
    mockCreateClient.mockReturnValue(
      makeSupa([
        { id: 'a', nome: 'Ana', telefone: '5511999' },
        { id: 'b', nome: 'Bia', telefone: '5511888' },
        { nome: 'Sem id/fone' },
      ])
    );

    const result = await syncPatientsFromClinic('org1', 'patients', { dryRun: true });

    expect(result).toMatchObject({ total: 3, eligible: 2, upserted: 0, contacts: 2, skipped: 1, dryRun: true });
    expect(prismaMock.patient.upsert).not.toHaveBeenCalled();
    expect(prismaMock.contact.upsert).not.toHaveBeenCalled();
  });

  it('vários pacientes no mesmo telefone => 1 contato, N pacientes', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(orgConfig('afeto387') as any);
    const supa = makeSupa([
      { id: 'p1', tenant_id: 'afeto387', name: 'Filho 1', phone: '5511999' },
      { id: 'p2', tenant_id: 'afeto387', name: 'Filho 2', phone: '5511999' },
      { id: 'p3', tenant_id: 'afeto387', name: 'Filho 3', phone: '5511999' },
    ]);
    mockCreateClient.mockReturnValue(supa);

    const result = await syncPatientsFromClinic('org1', 'patients');

    expect(result).toMatchObject({ upserted: 3, contacts: 1, tenantFiltered: true });
    expect(supa._builder.eq).toHaveBeenCalledWith('tenant_id', 'afeto387');
    expect(prismaMock.patient.upsert).toHaveBeenCalledTimes(3);
  });

  it('tabela multi-tenant SEM externalId é bloqueada (400)', async () => {
    prismaMock.organization.findUnique.mockResolvedValue(orgConfig(null) as any);
    mockCreateClient.mockReturnValue(makeSupa([{ id: 'x', tenant_id: 'tA', name: 'Ana', phone: '5511' }]));

    await expect(syncPatientsFromClinic('org1', 'patients')).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.patient.upsert).not.toHaveBeenCalled();
  });

  it('falha quando a integração não está configurada (400)', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({
      afetoClinicSupabaseUrl: null,
      afetoClinicSupabaseKey: null,
    } as any);

    await expect(testClinicConnection('org1')).rejects.toMatchObject({ statusCode: 400 });
  });
});
