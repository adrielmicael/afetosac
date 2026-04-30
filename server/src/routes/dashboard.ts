import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getDashboardStats, getReports } from '../controllers/dashboardController';

const router = Router();

router.use(authenticate);
router.get('/stats', getDashboardStats);
router.get('/reports', getReports);

export default router;
