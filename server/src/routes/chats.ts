import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { extractTenant } from '../middleware/tenant';
import {
  getChats,
  getChatById,
  assignChat,
  transferChat,
  closeChat,
  updateChatTags,
  linkPatient,
} from '../controllers/chatController';

const router = Router();

router.use(authenticate);
router.use(extractTenant);

router.get('/', getChats);
router.get('/:id', getChatById);
router.post('/:id/assign', assignChat);
router.post('/:id/transfer', transferChat);
router.post('/:id/close', closeChat);
router.put('/:id/tags', updateChatTags);
router.post('/:id/link-patient', linkPatient);

export default router;
