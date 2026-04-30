import { Router } from 'express';
import { verifyWebhook, receiveWebhook } from '../controllers/webhookController';

const router = Router();

router.get('/whatsapp', verifyWebhook);
router.post('/whatsapp', receiveWebhook);

export default router;
