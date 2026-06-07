// Env necessário antes de importar módulos que usam o cofre/JWT
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.JWT_SECRET = 'test-jwt-secret';

import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import integrationRoutes from '../../../src/routes/integrations';
import { errorHandler } from '../../../src/middleware/errorHandler';
import { encrypt } from '../../../src/utils/crypto';
import { prismaMock } from '../../setup';

jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hashed'), compare: jest.fn() }));

const SECRET = 'afc_test_secret_value';
const EXTERNAL_ID = 'clinic-tenant-1';

const app = express();
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);
app.use('/api/integrations', integrationRoutes);
app.use(errorHandler);

const sign = (timestamp: string, raw: string) =>
  crypto.createHmac('sha256', SECRET).update(`${timestamp}.${raw}`).digest('hex');

const post = (path: string, body: object, opts?: { badSig?: boolean; ts?: string }) => {
  const raw = JSON.stringify(body);
  const ts = opts?.ts || String(Date.now());
  const signature = opts?.badSig ? 'deadbeef' : sign(ts, raw);
  return request(app)
    .post(path)
    .set('Content-Type', 'application/json')
    .set('X-Afeto-Tenant', EXTERNAL_ID)
    .set('X-Afeto-Timestamp', ts)
    .set('X-Afeto-Signature', signature)
    .send(raw);
};

const orgMock = {
  id: 'o1',
  slug: 'clinica',
  externalId: EXTERNAL_ID,
  status: 'ACTIVE',
  afetoClinicEnabled: true,
  afetoClinicSecret: encrypt(SECRET),
  maxUsers: 10,
};

describe('Integração Afeto Clinic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.organization.findUnique.mockResolvedValue(orgMock as any);
    prismaMock.organizationMember.count.mockResolvedValue(0);
    prismaMock.deviceSession.create.mockResolvedValue({} as any);
    prismaMock.user.update.mockResolvedValue({} as any);
  });

  it('rejeita assinatura inválida (401)', async () => {
    const res = await post('/api/integrations/afeto-clinic/users', { email: 'a@b.com', name: 'A' }, { badSig: true });
    expect(res.status).toBe(401);
  });

  it('rejeita cabeçalhos ausentes (401)', async () => {
    const res = await request(app)
      .post('/api/integrations/afeto-clinic/users')
      .send({ email: 'a@b.com', name: 'A' });
    expect(res.status).toBe(401);
  });

  it('rejeita timestamp expirado (401)', async () => {
    const oldTs = String(Date.now() - 10 * 60 * 1000);
    const res = await post('/api/integrations/afeto-clinic/users', { email: 'a@b.com', name: 'A' }, { ts: oldTs });
    expect(res.status).toBe(401);
  });

  it('provisiona novo usuário (201) e é idempotente', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: 'u1', email: 'novo@clinic.com', name: 'Novo', avatar: null } as any);
    prismaMock.organizationMember.findFirst.mockResolvedValue(null);
    prismaMock.organizationMember.create.mockResolvedValue({} as any);

    const res = await post('/api/integrations/afeto-clinic/users', { email: 'novo@clinic.com', name: 'Novo', role: 'AGENT' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, createdUser: true, createdMembership: true, role: 'AGENT' });
    expect(prismaMock.organizationMember.create).toHaveBeenCalled();
  });

  it('usuário já membro não recria vínculo (200)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'ja@clinic.com', name: 'Ja', avatar: null } as any);
    prismaMock.organizationMember.findFirst.mockResolvedValue({ id: 'm1', isActive: true, role: 'ADMIN' } as any);

    const res = await post('/api/integrations/afeto-clinic/users', { email: 'ja@clinic.com', name: 'Ja' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, createdUser: false, createdMembership: false, role: 'ADMIN' });
    expect(prismaMock.organizationMember.create).not.toHaveBeenCalled();
  });

  it('SSO emite sessão de tenant', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'sso@clinic.com', name: 'SSO', avatar: null } as any);
    prismaMock.organizationMember.findFirst.mockResolvedValue({ id: 'm1', isActive: true, role: 'AGENT' } as any);

    const res = await post('/api/integrations/afeto-clinic/sso', { email: 'sso@clinic.com', name: 'SSO' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ organizationId: 'o1', role: 'AGENT' });
    expect(prismaMock.deviceSession.create).toHaveBeenCalled();
  });

  it('upsert de paciente: cria contato por telefone e paciente vinculado', async () => {
    prismaMock.contact.upsert.mockResolvedValue({ id: 'contact1' } as any);
    prismaMock.patient.create.mockResolvedValue({ id: 'p1', name: 'Paciente', phone: '5511999', email: null } as any);

    const res = await post('/api/integrations/afeto-clinic/patients', { name: 'Paciente', phone: '5511999' });

    expect(res.status).toBe(200);
    expect(prismaMock.contact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_phone: { organizationId: 'o1', phone: '5511999' } },
      })
    );
    expect(prismaMock.patient.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ contactId: 'contact1', phone: '5511999' }) })
    );
  });

  it('upsert de paciente com externalId usa identidade do Clinic', async () => {
    prismaMock.contact.upsert.mockResolvedValue({ id: 'contact1' } as any);
    prismaMock.patient.upsert.mockResolvedValue({ id: 'p1', name: 'Filho', phone: '5511999', email: null } as any);

    const res = await post('/api/integrations/afeto-clinic/patients', { name: 'Filho', phone: '5511999', externalId: 'cli-99' });

    expect(res.status).toBe(200);
    expect(prismaMock.patient.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_externalId: { organizationId: 'o1', externalId: 'cli-99' } },
      })
    );
  });
});
