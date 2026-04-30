import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getQuickReplies,
  createQuickReply,
  updateQuickReply,
  deleteQuickReply,
} from '../controllers/quickReplyController';

const router = Router();

router.use(authenticate);

router.get('/', getQuickReplies);
router.post('/', createQuickReply);
router.put('/:id', updateQuickReply);
router.delete('/:id', deleteQuickReply);

export default router;
