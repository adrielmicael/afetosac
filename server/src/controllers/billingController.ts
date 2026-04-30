import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

// Stripe é opcional — só instancia se a chave estiver configurada
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-03-25.dahlia' })
  : null;

function requireStripe(): InstanceType<typeof Stripe> {
  if (!stripe) throw new AppError('Stripe não configurado neste ambiente', 503);
  return stripe;
}

type BillingPlan = {
  id: string;
  name: string;
  price: number;
  maxUsers: number;
  maxChats: number;
  maxStorageGB: number;
  features: string[];
  priceId?: string;
};

// Planos disponíveis
export const PLANS = {
  FREE: {
    id: 'FREE',
    name: 'Gratuito',
    price: 0,
    maxUsers: 3,
    maxChats: 100,
    maxStorageGB: 1,
    features: ['Chat básico', 'WhatsApp', 'Até 3 usuários'],
  },
  STARTER: {
    id: 'STARTER',
    name: 'Iniciante',
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    price: 49,
    maxUsers: 10,
    maxChats: 500,
    maxStorageGB: 5,
    features: ['Tudo do Gratuito', 'Até 10 usuários', 'Relatórios', 'Chatbot'],
  },
  PRO: {
    id: 'PRO',
    name: 'Profissional',
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    price: 149,
    maxUsers: 50,
    maxChats: -1, // Unlimited
    maxStorageGB: 50,
    features: ['Tudo do Iniciante', 'Usuários ilimitados', 'API', 'Prioridade no suporte'],
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Empresarial',
    price: -1, // Custom
    maxUsers: -1,
    maxChats: -1,
    maxStorageGB: -1,
    features: ['Tudo do Profissional', 'SLA garantido', 'Suporte 24/7', 'On-premise option'],
  },
} as const satisfies Record<string, BillingPlan>;

/**
 * Obter planos disponíveis
 */
export const getPlans = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    res.json({
      success: true,
      plans: Object.values(PLANS).map(plan => ({
        ...plan,
        current: false,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Criar sessão de checkout Stripe
 */
export const createCheckoutSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = (req as any).tenant?.id;
    const { planId, billingCycle = 'monthly' } = req.body;
    
    const plan = PLANS[planId as keyof typeof PLANS] as BillingPlan | undefined;
    if (!plan) {
      throw new AppError('Invalid plan', 400);
    }
    
    if (planId === 'FREE' || planId === 'ENTERPRISE') {
      throw new AppError('Cannot checkout this plan', 400);
    }

    if (!plan.priceId) {
      throw new AppError('Selected plan is not configured for Stripe checkout', 400);
    }
    
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }
    
    // Criar ou atualizar customer no Stripe
    let customerId = organization.stripeCustomerId;
    if (!customerId) {
      const customer = await requireStripe().customers.create({
        name: organization.name,
        metadata: {
          organizationId: organization.id,
        },
      });
      customerId = customer.id;
      
      await prisma.organization.update({
        where: { id: organizationId },
        data: { stripeCustomerId: customerId },
      });
    }
    
    // Criar sessão de checkout
    const session = await requireStripe().checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/billing/cancel`,
      metadata: {
        organizationId: organization.id,
        planId: plan.id,
      },
    });
    
    res.json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Portal do cliente Stripe
 */
export const createPortalSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = (req as any).tenant?.id;
    
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    
    if (!organization?.stripeCustomerId) {
      throw new AppError('No Stripe customer found', 400);
    }
    
    const session = await requireStripe().billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/billing`,
    });
    
    res.json({
      success: true,
      url: session.url,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obter status da assinatura
 */
export const getSubscriptionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = (req as any).tenant?.id;
    
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    
    if (!organization) {
      throw new AppError('Organization not found', 404);
    }
    
    let subscription: any = null;
    if (organization.stripeSubscriptionId) {
      subscription = await requireStripe().subscriptions.retrieve(
        organization.stripeSubscriptionId
      );
    }
    
    const plan = (PLANS[organization.plan as keyof typeof PLANS] || PLANS.FREE) as BillingPlan;
    
    res.json({
      success: true,
      subscription: {
        plan: organization.plan,
        planName: plan.name,
        status: subscription?.status || 'active',
        currentPeriodStart: subscription?.current_period_start
          ? new Date(subscription.current_period_start * 1000)
          : null,
        currentPeriodEnd: subscription?.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null,
        cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
        limits: {
          maxUsers: plan.maxUsers,
          maxChats: plan.maxChats,
          maxStorageGB: plan.maxStorageGB,
        },
        features: plan.features,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Webhook do Stripe
 */
export const stripeWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sig = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    
    let event: any;
    
    try {
      event = requireStripe().webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
      logger.error(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    logger.info(`Stripe webhook received: ${event.type}`);
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        await handleCheckoutCompleted(session);
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        await handlePaymentSucceeded(invoice);
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        await handlePaymentFailed(invoice);
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        await handleSubscriptionUpdated(subscription);
        break;
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
};

// Handlers de webhook
async function handleCheckoutCompleted(session: any) {
  const organizationId = session.metadata?.organizationId;
  const planId = session.metadata?.planId;
  
  if (!organizationId || !planId) return;
  
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      plan: planId,
      stripeSubscriptionId: session.subscription as string,
      status: 'ACTIVE',
    },
  });
  
  logger.info(`Organization ${organizationId} upgraded to ${planId}`);
}

async function handlePaymentSucceeded(invoice: any) {
  // Notificar usuário de pagamento bem-sucedido
  logger.info(`Payment succeeded for customer ${invoice.customer}`);
}

async function handlePaymentFailed(invoice: any) {
  // Notificar usuário de falha no pagamento
  // Dar um período de graça
  logger.warn(`Payment failed for customer ${invoice.customer}`);
}

async function handleSubscriptionDeleted(subscription: any) {
  const organization = await prisma.organization.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });
  
  if (organization) {
    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        plan: 'FREE',
        stripeSubscriptionId: null,
      },
    });
    
    logger.info(`Organization ${organization.id} downgraded to FREE`);
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  // Atualizar status da assinatura
  logger.info(`Subscription ${subscription.id} updated`);
}
