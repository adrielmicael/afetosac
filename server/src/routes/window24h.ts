import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  checkWindowStatus,
  reopenWindowWithTemplate,
  getAvailableTemplates,
  getWindowStats,
} from '../controllers/window24hController';

const router = Router();

router.use(authenticate);

// Verificar status da janela
router.get('/chats/:chatId/window-status', checkWindowStatus);

// Reabrir janela com template
router.post('/chats/:chatId/reopen-window', reopenWindowWithTemplate);

// Listar templates disponíveis
router.get('/window-templates', getAvailableTemplates);

// Estatísticas da janela (dashboard)
router.get('/window-stats', authorize('ADMIN', 'SUPERVISOR'), getWindowStats);

export default router;
