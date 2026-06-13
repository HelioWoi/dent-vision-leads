
import { createClient } from '@supabase/supabase-js';

const envBag = (import.meta as any).env || {};

// ---------------------------------------------------------------------------
// CONFIGURAÇÃO DO SUPABASE
// ---------------------------------------------------------------------------

const PRODUCTION_SUPABASE_URL = 'https://wtfstakxspbnghalelby.supabase.co';

export const resolveSupabaseUrl = () => {
  const envBag = (import.meta as any).env || {};
  if (envBag.VITE_SUPABASE_URL) return String(envBag.VITE_SUPABASE_URL).replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('netlify.app') || host.includes('dentvision')) {
      return PRODUCTION_SUPABASE_URL;
    }
  }
  return 'http://127.0.0.1:54321';
};

// 1. URL do Projeto - Uses environment variable, falls back to production on Netlify
export const supabaseUrl = resolveSupabaseUrl();

// 2. Chave API (anon public) - Uses environment variable, falls back to production
const supabaseKey = envBag.VITE_SUPABASE_ANON_KEY;

const fallbackSupabaseUrl = 'https://placeholder.supabase.co';
const fallbackSupabaseKey = 'placeholder-anon-key';

// Verifica se as chaves foram preenchidas
export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey && !supabaseKey.includes("COLE_SUA_CHAVE"));

if (!isSupabaseConfigured) {
    console.warn('Supabase configuration missing or placeholder detected.');
    console.warn('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file');
    console.warn('For local development, run: supabase status');
}

export const supabase = createClient(
    isSupabaseConfigured ? supabaseUrl : fallbackSupabaseUrl,
    isSupabaseConfigured ? supabaseKey : fallbackSupabaseKey
);
