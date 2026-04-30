import { Router } from 'express';
import express from 'express';
import { authenticate } from '../middleware/auth';
import { extractTenant } from '../middleware/tenant';
import {
  getPlans,
  createCheckoutSession,
  createPortalSession,
  getSubscriptionStatus,
  stripeWebhook,
} from '../controllers/billingController';

const router = Router();

// Webhook (público, mas verificado por Stripe)
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// Rotas protegidas
router.use(authenticate);
router.use(extractTenant);

router.get('/plans', getPlans);
router.get('/subscription', getSubscriptionStatus);
router.post('/checkout', createCheckoutSession);
router.post('/portal', createPortalSession);

export default router;
