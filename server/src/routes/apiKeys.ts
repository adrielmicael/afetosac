import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/tenant';
import { listApiKeys, createApiKey, revokeApiKey } from '../controllers/apiKeyController';

const router = Router();

router.use(authenticate);
router.use(requireRole('OWNER', 'ADMIN'));

router.get('/', listApiKeys);
router.post('/', createApiKey);
router.delete('/:id', revokeApiKey);

export default router;
