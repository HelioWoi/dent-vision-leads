
import { createClient } from '@supabase/supabase-js';

const envBag = (import.meta as any).env || {};

// ---------------------------------------------------------------------------
// CONFIGURAÇÃO DO SUPABASE
// ---------------------------------------------------------------------------

// 1. URL do Projeto - Uses environment variable, falls back to production
export const supabaseUrl = envBag.VITE_SUPABASE_URL;

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
