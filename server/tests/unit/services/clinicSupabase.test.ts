// Credenciais GLOBAIS (nível desenvolvedor) — definidas antes de importar o módulo
process.env.AFETO_CLINIC_SUPABASE_URL = 'https://x.supabase.co';
process.env.AFETO_CLINIC_SUPABASE_KEY = 'the-key';

import {
  testClinicConnection,
  syncPatientsFromClinic,
  isClinicIntegrationAvailable,
} from '../../../src/services/clinicSupabaseService';
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

describe('clinicSupabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AFETO_CLINIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.AFETO_CLINIC_SUPABASE_KEY = 'the-key';
    prismaMock.organization.findUnique.mockResolvedValue({ externalId: null } as any);
    prismaMock.contact.upsert.mockResolvedValue({ id: 'contact1' } as any);
    prismaMock.patient.upsert.mockResolvedValue({ id: 'p1' } as any);
  });

  it('usa as credenciais GLOBAIS (env) para conectar', async () => {
    mockCreateClient.mockReturnValue(makeSupa([{ id: 1, nome: 'Ana', telefone: '5511' }]));

    const result = await testClinicConnection('org1', 'patients');

    expect(mockCreateClient).toHaveBeenCalledWith('https://x.supabase.co', 'the-key', expect.any(Object));
    expect(result.ok).toBe(true);
    expect(result.columns).toEqual(expect.arrayContaining(['nome', 'telefone']));
  });

  it('isClinicIntegrationAvailable reflete o env', () => {
    expect(isClinicIntegrationAvailable()).toBe(true);
    delete process.env.AFETO_CLINIC_SUPABASE_URL;
    delete process.env.CLINIC_SUPABASE_URL;
    expect(isClinicIntegrationAvailable()).toBe(false);
  });

  it('falha quando a plataforma não configurou o Supabase (400)', async () => {
    delete process.env.AFETO_CLINIC_SUPABASE_URL;
    delete process.env.CLINIC_SUPABASE_URL;
    await expect(testClinicConnection('org1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('sincroniza (sem tenant_id) criando contato + paciente', async () => {
    mockCreateClient.mockReturnValue(
      makeSupa([
        { id: 'cli-1', nome: 'Ana', telefone: '5511999', email: 'ana@x.com' },
        { nome: 'Sem id/fone' },
      ])
    );

    const result = await syncPatientsFromClinic('org1', 'patients');

    expect(result).toMatchObject({ total: 2, eligible: 1, upserted: 1, contacts: 1, skipped: 1, tenantFiltered: false });
    expect(prismaMock.patient.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_externalId: { organizationId: 'org1', externalId: 'cli-1' } },
        create: expect.objectContaining({ name: 'Ana', phone: '5511999', contactId: 'contact1' }),
      })
    );
  });

  it('vários pacientes no mesmo telefone => 1 contato, N pacientes (com tenant)', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ externalId: 'afeto387' } as any);
    const supa = makeSupa([
      { id: 'p1', tenant_id: 'afeto387', name: 'Filho 1', phone: '5511999' },
      { id: 'p2', tenant_id: 'afeto387', name: 'Filho 2', phone: '5511999' },
    ]);
    mockCreateClient.mockReturnValue(supa);

    const result = await syncPatientsFromClinic('org1', 'patients');

    expect(result).toMatchObject({ upserted: 2, contacts: 1, tenantFiltered: true });
    expect(supa._builder.eq).toHaveBeenCalledWith('tenant_id', 'afeto387');
  });

  it('tabela multi-tenant SEM tenant da clínica é bloqueada (400)', async () => {
    prismaMock.organization.findUnique.mockResolvedValue({ externalId: null } as any);
    mockCreateClient.mockReturnValue(makeSupa([{ id: 'x', tenant_id: 'tA', name: 'Ana', phone: '5511' }]));

    await expect(syncPatientsFromClinic('org1', 'patients')).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.patient.upsert).not.toHaveBeenCalled();
  });
});
