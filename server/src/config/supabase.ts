import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Cliente Supabase para uso no servidor
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false,
  },
});

// Cliente Supabase para Storage (uploads)
export const supabaseStorage = createClient(supabaseUrl, supabaseKey);

// Helper para verificar conexão
export async function checkSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('users').select('count').single();
    if (error) throw error;
    return { connected: true, error: null };
  } catch (error: any) {
    return { connected: false, error: error.message };
  }
}

export default supabase;
