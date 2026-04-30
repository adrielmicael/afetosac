import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getFlows,
  createFlow,
  updateFlow,
  deleteFlow,
  endSession,
  getStats,
} from '../controllers/chatbotController';

const router = Router();

router.use(authenticate);

// CRUD Fluxos (admin/supervisor)
router.get('/flows', getFlows);
router.post('/flows', authorize('ADMIN', 'SUPERVISOR'), createFlow);
router.put('/flows/:id', authorize('ADMIN', 'SUPERVISOR'), updateFlow);
router.delete('/flows/:id', authorize('ADMIN', 'SUPERVISOR'), deleteFlow);

// Encerrar sessão (fallback para humano)
router.post('/sessions/:chatId/end', endSession);

// Estatísticas
router.get('/stats', authorize('ADMIN', 'SUPERVISOR'), getStats);

export default router;
