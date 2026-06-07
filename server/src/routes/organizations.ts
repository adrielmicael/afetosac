import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { extractTenant, requireRole } from '../middleware/tenant';
import {
  createOrganization,
  listUserOrganizations,
  getCurrentOrganization,
  updateOrganization,
  inviteMember,
  listMembers,
  removeMember,
  updateMemberRole,
  getWhatsAppConfig,
  updateWhatsAppConfig,
  getAfetoClinicConfig,
  updateAfetoClinicConfig,
  testAfetoClinicSupabase,
  syncAfetoClinicPatients,
} from '../controllers/organizationController';

const router = Router();

// Público - Onboarding
router.post('/create', createOrganization);

// Autenticado
router.use(authenticate);

router.get('/my', listUserOrganizations);

// Requer tenant
router.use(extractTenant);

router.get('/current', getCurrentOrganization);
router.put('/current', requireRole('OWNER', 'ADMIN'), updateOrganization);

// Configuração WhatsApp (segredos cifrados em repouso)
router.get('/whatsapp', requireRole('OWNER', 'ADMIN'), getWhatsAppConfig);
router.put('/whatsapp', requireRole('OWNER', 'ADMIN'), updateWhatsAppConfig);

// Integração Afeto Clinic (SSO/provisionamento)
router.get('/afeto-clinic', requireRole('OWNER', 'ADMIN'), getAfetoClinicConfig);
router.put('/afeto-clinic', requireRole('OWNER', 'ADMIN'), updateAfetoClinicConfig);
// Leitura/sync via Supabase REST do Afeto Clinic
router.get('/afeto-clinic/supabase/test', requireRole('OWNER', 'ADMIN'), testAfetoClinicSupabase);
router.post('/afeto-clinic/supabase/sync-patients', requireRole('OWNER', 'ADMIN'), syncAfetoClinicPatients);

// Membros
router.get('/members', listMembers);
router.post('/members', requireRole('OWNER', 'ADMIN'), inviteMember);
router.put('/members/:memberId/role', requireRole('OWNER', 'ADMIN'), updateMemberRole);
router.delete('/members/:memberId', requireRole('OWNER', 'ADMIN'), removeMember);

export default router;
