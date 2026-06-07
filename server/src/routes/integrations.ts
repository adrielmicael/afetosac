import { Router } from 'express';
import { verifyAfetoClinicSignature } from '../middleware/integrationAuth';
import { provisionUser, ssoExchange, upsertPatient } from '../controllers/integrationController';

const router = Router();

// Todas as rotas exigem assinatura HMAC válida do tenant (Afeto Clinic)
router.use('/afeto-clinic', verifyAfetoClinicSignature);

router.post('/afeto-clinic/users', provisionUser);
router.post('/afeto-clinic/sso', ssoExchange);
router.post('/afeto-clinic/patients', upsertPatient);

export default router;
