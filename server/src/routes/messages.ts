import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { extractTenant } from '../middleware/tenant';
import {
  getMessages,
  sendMessage,
  sendTemplate,
  markAsRead,
} from '../controllers/messageController';

const router = Router();

router.use(authenticate);
router.use(extractTenant);

router.get('/:chatId', getMessages);
router.post('/:chatId', sendMessage);
router.post('/:chatId/template', sendTemplate);
router.post('/:chatId/read', markAsRead);

export default router;
