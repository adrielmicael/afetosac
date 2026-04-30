import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  generate2FASecret,
  verifyAndEnable2FA,
  disable2FA,
  verify2FALogin,
  regenerateBackupCodes,
} from '../controllers/twoFactorController';

const router = Router();

// Rotas protegidas (usuário logado)
router.post('/setup', authenticate, generate2FASecret);
router.post('/verify', authenticate, verifyAndEnable2FA);
router.post('/disable', authenticate, disable2FA);
router.post('/backup-codes', authenticate, regenerateBackupCodes);

// Rota pública (durante login)
router.post('/login/verify', verify2FALogin);

export default router;
