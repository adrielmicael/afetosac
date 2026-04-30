import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { getQualityKpis } from '../controllers/kpiController';

const router = Router();

router.use(authenticate);

// Apenas admin/supervisor/owner visualizam KPIs de parceiro Meta
router.get('/quality', authorize('OWNER', 'ADMIN', 'SUPERVISOR'), getQualityKpis);

export default router;
