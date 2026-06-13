
import { createClient } from '@supabase/supabase-js';
import {
  PRODUCTION_SUPABASE_ANON_KEY,
  PRODUCTION_SUPABASE_URL,
  isProductionHost,
} from './productionSupabase';

// ---------------------------------------------------------------------------
// CONFIGURAÇÃO DO SUPABASE
// ---------------------------------------------------------------------------

export const resolveSupabaseUrl = () => {
  const envBag = (import.meta as any).env || {};
  if (envBag.VITE_SUPABASE_URL) return String(envBag.VITE_SUPABASE_URL).replace(/\/$/, '');
  if (isProductionHost()) return PRODUCTION_SUPABASE_URL;
  return 'http://127.0.0.1:54321';
};

export const resolveSupabaseAnonKey = () => {
  const envBag = (import.meta as any).env || {};
  const envKey = envBag.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (envKey && !envKey.includes('your_') && !envKey.includes('COLE_SUA')) {
    return envKey;
  }
  if (resolveSupabaseUrl() === PRODUCTION_SUPABASE_URL) {
    return PRODUCTION_SUPABASE_ANON_KEY;
  }
  return envKey || '';
};

export const supabaseUrl = resolveSupabaseUrl();
const supabaseKey = resolveSupabaseAnonKey();

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured && typeof window !== 'undefined') {
  console.warn('Supabase configuration missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseKey : 'placeholder-anon-key',
);
