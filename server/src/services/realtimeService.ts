/**
 * Supabase Realtime - Substituto do Socket.io
 * Para funcionar com Netlify Functions (serverless)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
let warnedMissingRealtimeConfig = false;
let supabaseClient: ReturnType<typeof createClient> | null = null;

const getSupabaseClient = () => {
  if (!supabaseUrl || !supabaseKey) {
    if (!warnedMissingRealtimeConfig) {
      warnedMissingRealtimeConfig = true;
      console.warn('Supabase realtime disabled: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.');
    }
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }

  return supabaseClient;
};

/**
 * Enviar mensagem em tempo real para um chat
 * Substitui: io.to(`chat:${chatId}`).emit('message:new', message)
 */
export const broadcastToChat = async (chatId: string, event: string, payload: any) => {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return;
    }

    await client
      .channel(`chat:${chatId}`)
      .send({
        type: 'broadcast',
        event,
        payload,
      });
  } catch (error) {
    console.error('Realtime broadcast error:', error);
  }
};

/**
 * Notificar todos os agentes de uma organização
 */
export const broadcastToOrganization = async (organizationId: string, event: string, payload: any) => {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return;
    }

    await client
      .channel(`org:${organizationId}`)
      .send({
        type: 'broadcast',
        event,
        payload,
      });
  } catch (error) {
    console.error('Realtime broadcast error:', error);
  }
};

/**
 * Notificar usuário específico
 */
export const broadcastToUser = async (userId: string, event: string, payload: any) => {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return;
    }

    await client
      .channel(`user:${userId}`)
      .send({
        type: 'broadcast',
        event,
        payload,
      });
  } catch (error) {
    console.error('Realtime broadcast error:', error);
  }
};

/**
 * No frontend, o cliente deve se inscrever assim:
 * 
 * const channel = supabase
 *   .channel(`chat:${chatId}`)
 *   .on('broadcast', { event: 'message:new' }, (payload) => {
 *     console.log('New message:', payload);
 *   })
 *   .subscribe();
 */

export default {
  broadcastToChat,
  broadcastToOrganization,
  broadcastToUser,
};
