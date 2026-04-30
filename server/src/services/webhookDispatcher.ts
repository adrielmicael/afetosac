/**
 * Webhook Dispatcher
 * Envia eventos para endpoints externos configurados pela organização.
 * Fire-and-forget com tolerância a falha (serverless-friendly).
 */

import crypto from 'crypto';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export type WebhookEvent =
  | 'chat.created'
  | 'chat.closed'
  | 'chat.assigned'
  | 'message.received'
  | 'message.sent'
  | 'patient.created';

interface WebhookPayload {
  event: WebhookEvent;
  organizationId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

function sign(secret: string, body: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
}

async function deliverToEndpoint(
  endpointId: string,
  url: string,
  secret: string,
  payload: WebhookPayload
): Promise<{ status: string; ok: boolean }> {
  const body = JSON.stringify(payload);
  const signature = sign(secret, body);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Afeto-Signature': signature,
        'X-Afeto-Event': payload.event,
        'User-Agent': 'AfetoSAC-Webhooks/1.0',
      },
      body,
      signal: AbortSignal.timeout(8000),
    });

    const status = String(response.status);
    const ok = response.ok;

    await prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        lastDeliveryAt: new Date(),
        lastStatus: status,
        failureCount: ok ? 0 : { increment: 1 },
        // Desabilitar automaticamente após 10 falhas consecutivas
        isActive: ok ? true : undefined,
      },
    });

    if (!ok) {
      logger.warn(`Webhook delivery failed [${status}] → ${url}`);
      // Desabilitar após 10 falhas
      const endpoint = await prisma.webhookEndpoint.findUnique({
        where: { id: endpointId },
        select: { failureCount: true },
      });
      if (endpoint && endpoint.failureCount >= 10) {
        await prisma.webhookEndpoint.update({
          where: { id: endpointId },
          data: { isActive: false },
        });
        logger.warn(`Webhook endpoint auto-disabled after 10 failures: ${endpointId}`);
      }
    }

    return { status, ok };
  } catch (err: any) {
    const status = 'timeout';
    await prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        lastDeliveryAt: new Date(),
        lastStatus: status,
        failureCount: { increment: 1 },
      },
    });
    logger.warn(`Webhook delivery error → ${url}: ${err.message}`);
    return { status, ok: false };
  }
}

export async function dispatchWebhookEvent(
  organizationId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, url: true, secret: true, events: true },
    });

    if (endpoints.length === 0) return;

    const payload: WebhookPayload = {
      event,
      organizationId,
      timestamp: new Date().toISOString(),
      data,
    };

    const applicable = endpoints.filter((ep) => {
      try {
        const events: string[] = JSON.parse(ep.events);
        return events.includes(event) || events.includes('*');
      } catch {
        return false;
      }
    });

    // Disparar em paralelo, sem bloquear a resposta HTTP
    await Promise.allSettled(
      applicable.map((ep) => deliverToEndpoint(ep.id, ep.url, ep.secret, payload))
    );
  } catch (err: any) {
    logger.error(`dispatchWebhookEvent error: ${err.message}`);
  }
}
