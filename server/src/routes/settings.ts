import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getSettings, updateSettings } from '../controllers/settingsController';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', getSettings);
router.put('/', updateSettings);

export default router;
