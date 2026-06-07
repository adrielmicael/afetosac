import { Router } from 'express';
import { authenticatePlatform, requirePlatformRole } from '../middleware/platformAuth';
import {
  validatePlatformLogin,
  platformLogin,
  platformVerify2FA,
  platformMe,
  platformLogout,
  platformLogoutAll,
  platformSetup2FA,
  platformEnable2FA,
} from '../controllers/platformAuthController';
import {
  listOrganizations,
  getOrganizationDetail,
  updateOrganizationStatus,
  updateOrganizationPlan,
  updateOrganizationLimits,
  extendTrial,
  recomputeUsage,
  createOrganizationByPlatform,
  impersonateOrganization,
} from '../controllers/platformController';
import {
  getOverview,
  getBilling,
  getOperationsHealth,
  getLgpdRequests,
} from '../controllers/platformInsightsController';

const router = Router();

// Público (login de plataforma — separado do login de tenant)
router.post('/auth/login', validatePlatformLogin, platformLogin);
router.post('/auth/2fa/verify', platformVerify2FA);

// Protegido (operador de plataforma autenticado)
router.use(authenticatePlatform);

router.get('/auth/me', platformMe);
router.post('/auth/logout', platformLogout);
router.post('/auth/logout-all', platformLogoutAll);

// Setup de 2FA (política: obrigatório para operadores)
router.post('/auth/2fa/setup', platformSetup2FA);
router.post('/auth/2fa/enable', platformEnable2FA);

// ===== Painel: leitura (qualquer papel de plataforma) =====
router.get('/overview', getOverview);
router.get('/billing', getBilling);
router.get('/operations', getOperationsHealth);
router.get('/lgpd', getLgpdRequests);
router.get('/organizations', listOrganizations);
router.get('/organizations/:id', getOrganizationDetail);
router.post('/organizations/:id/recompute-usage', requirePlatformRole('SUPPORT'), recomputeUsage);

// ===== Painel: ciclo de vida (SUPPORT+) =====
router.post('/organizations', requirePlatformRole('SUPPORT'), createOrganizationByPlatform);
router.patch('/organizations/:id/status', requirePlatformRole('SUPPORT'), updateOrganizationStatus);
router.post('/organizations/:id/impersonate', requirePlatformRole('SUPPORT'), impersonateOrganization);

// ===== Painel: billing/limites (BILLING+) =====
router.patch('/organizations/:id/plan', requirePlatformRole('BILLING'), updateOrganizationPlan);
router.post('/organizations/:id/extend-trial', requirePlatformRole('BILLING'), extendTrial);

// ===== Painel: override de limites (apenas SUPERADMIN) =====
router.patch('/organizations/:id/limits', requirePlatformRole(), updateOrganizationLimits);

export default router;
