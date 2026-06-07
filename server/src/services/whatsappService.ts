import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import { logger } from '../utils/logger';
import prisma from '../config/database';
import { decrypt } from '../utils/crypto';

export interface WhatsAppConfig {
  apiUrl?: string;
  accessToken?: string;
  phoneNumberId?: string;
}

export class WhatsAppNotConfiguredError extends Error {
  constructor() {
    super('WhatsApp não configurado para esta organização');
    this.name = 'WhatsAppNotConfiguredError';
  }
}

// Erros transientes da API da Meta que justificam retry
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/**
 * Retry com backoff exponencial + jitter.
 * Tenta até `maxAttempts` vezes. Aborta em erros não transientes (4xx exceto 429).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as AxiosError)?.response?.status;

      // Não tenta novamente para erros permanentes do cliente (exceto 429)
      if (status !== undefined && !TRANSIENT_STATUS_CODES.has(status)) {
        logger.warn(`[${context}] Permanent error ${status} — aborting retries`);
        throw err;
      }

      if (attempt === maxAttempts) break;

      // Backoff exponencial: 1s, 2s, 4s… + jitter ±20%
      const jitter = 1 + (Math.random() * 0.4 - 0.2);
      const delay = baseDelayMs * Math.pow(2, attempt - 1) * jitter;

      logger.warn(`[${context}] Attempt ${attempt}/${maxAttempts} failed (status=${status ?? 'network'}). Retrying in ${Math.round(delay)}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  logger.error(`[${context}] All ${maxAttempts} attempts failed`);
  throw lastError;
}

export class WhatsAppService {
  private apiUrl: string;
  private accessToken: string;
  private phoneNumberId: string;

  /**
   * Sem config explícita, cai no env global (uso em dev / fallback).
   * Em produção multi-tenant, use `getWhatsAppClient(organizationId)`.
   */
  constructor(config?: WhatsAppConfig) {
    this.apiUrl = config?.apiUrl || process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
    this.accessToken = config?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = config?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  }

  isConfigured(): boolean {
    return Boolean(this.accessToken && this.phoneNumberId);
  }

  async sendMessage(
    to: string,
    content: string,
    type: string = 'TEXT'
  ): Promise<any> {
    if (!this.isConfigured()) {
      logger.warn('WhatsApp credentials not configured');
      throw new WhatsAppNotConfiguredError();
    }

    try {
      const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

      let messageData: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(to),
      };

      switch (type) {
        case 'TEXT':
          messageData.type = 'text';
          messageData.text = { body: content };
          break;
        case 'IMAGE':
          messageData.type = 'image';
          messageData.image = { link: content };
          break;
        case 'DOCUMENT':
          messageData.type = 'document';
          messageData.document = { link: content };
          break;
        default:
          messageData.type = 'text';
          messageData.text = { body: content };
      }

      const response = await withRetry(
        () => axios.post(url, messageData, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }),
        `sendMessage:${to}`
      );

      logger.info(`WhatsApp message sent to ${to}`);
      return response.data;
    } catch (error: any) {
      logger.error('WhatsApp API error:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendTemplate(
    to: string,
    templateName: string,
    variables: string[] = []
  ): Promise<any> {
    if (!this.isConfigured()) {
      logger.warn('WhatsApp credentials not configured');
      throw new WhatsAppNotConfiguredError();
    }

    try {
      const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

      const components = variables.length > 0
        ? [
            {
              type: 'body',
              parameters: variables.map((var_value) => ({
                type: 'text',
                text: var_value,
              })),
            },
          ]
        : [];

      const messageData = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: this.formatPhoneNumber(to),
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'pt_BR' },
          components,
        },
      };

      const response = await withRetry(
        () => axios.post(url, messageData, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }),
        `sendTemplate:${to}:${templateName}`
      );

      logger.info(`WhatsApp template sent to ${to}: ${templateName}`);
      return response.data;
    } catch (error: any) {
      logger.error('WhatsApp template error:', error.response?.data || error.message);
      throw error;
    }
  }

  async getMediaUrl(mediaId: string): Promise<string> {
    try {
      const url = `${this.apiUrl}/${mediaId}`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return response.data.url;
    } catch (error: any) {
      logger.error('WhatsApp getMediaUrl error:', error.response?.data || error.message);
      throw error;
    }
  }

  async downloadMedia(mediaUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(mediaUrl, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error: any) {
      logger.error('WhatsApp downloadMedia error:', error.response?.data || error.message);
      throw error;
    }
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | false {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';

    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }

    return false;
  }

  private formatPhoneNumber(phone: string): string {
    // Remove non-numeric characters
    let cleaned = phone.replace(/\D/g, '');

    // Ensure it starts with country code
    if (!cleaned.startsWith('55') && cleaned.length === 11) {
      cleaned = '55' + cleaned;
    }

    return cleaned;
  }
}

// Instância global (env) — usada apenas como fallback de desenvolvimento.
export const whatsappService = new WhatsAppService();

/**
 * Constrói um cliente WhatsApp com as credenciais da organização,
 * decifrando o access token armazenado em repouso.
 */
export async function getWhatsAppClient(
  organizationId: string
): Promise<WhatsAppService> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      whatsappApiUrl: true,
      whatsappAccessToken: true,
      whatsappPhoneNumberId: true,
    },
  });

  if (!org) {
    return new WhatsAppService();
  }

  return new WhatsAppService({
    apiUrl: org.whatsappApiUrl || undefined,
    accessToken: decrypt(org.whatsappAccessToken) || undefined,
    phoneNumberId: org.whatsappPhoneNumberId || undefined,
  });
}

/** Atualiza o estado de saúde da conexão WhatsApp da organização. */
export async function recordWhatsAppHealth(
  organizationId: string,
  status: 'CONNECTED' | 'ERROR' | 'NOT_CONFIGURED',
  errorMessage?: string
): Promise<void> {
  try {
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        whatsappStatus: status,
        whatsappLastError: status === 'ERROR' ? errorMessage?.slice(0, 500) || 'unknown' : null,
        whatsappLastCheckedAt: new Date(),
      },
    });
  } catch (error) {
    logger.warn('Failed to record WhatsApp health', error);
  }
}
