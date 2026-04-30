import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getSLAConfig,
  updateSLAConfig,
  createSLAConfig,
  calculateChatSLA,
  getSLAReport,
  assignSLAToChat,
} from '../controllers/slaController';

const router = Router();

router.use(authenticate);

// Configurações SLA (apenas admin/supervisor)
router.get('/config', getSLAConfig);
router.post('/config', authorize('ADMIN', 'SUPERVISOR'), createSLAConfig);
router.put('/config/:id', authorize('ADMIN', 'SUPERVISOR'), updateSLAConfig);

// Status SLA de um chat
router.get('/chats/:chatId/status', calculateChatSLA);

// Atribuir SLA a um chat
router.post('/chats/:chatId/assign', authorize('ADMIN', 'SUPERVISOR'), assignSLAToChat);

// Relatório SLA
router.get('/report', authorize('ADMIN', 'SUPERVISOR'), getSLAReport);

export default router;
