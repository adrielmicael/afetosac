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

// Membros
router.get('/members', listMembers);
router.post('/members', requireRole('OWNER', 'ADMIN'), inviteMember);
router.put('/members/:memberId/role', requireRole('OWNER', 'ADMIN'), updateMemberRole);
router.delete('/members/:memberId', requireRole('OWNER', 'ADMIN'), removeMember);

export default router;
