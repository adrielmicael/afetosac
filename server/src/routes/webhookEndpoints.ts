import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/tenant';
import {
  listWebhookEndpoints,
  createWebhookEndpoint,
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
  testWebhookEndpoint,
} from '../controllers/webhookEndpointController';

const router = Router();

router.use(authenticate);
router.use(requireRole('OWNER', 'ADMIN'));

router.get('/', listWebhookEndpoints);
router.post('/', createWebhookEndpoint);
router.put('/:id', updateWebhookEndpoint);
router.delete('/:id', deleteWebhookEndpoint);
router.post('/:id/test', testWebhookEndpoint);

export default router;
