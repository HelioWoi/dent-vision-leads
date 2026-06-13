/** Public Supabase production config (anon/publishable keys are safe in frontend). */
export const PRODUCTION_SUPABASE_URL = 'https://wtfstakxspbnghalelby.supabase.co';
export const PRODUCTION_SUPABASE_ANON_KEY =
  'sb_publishable__wJbeP572k2UJRHnLM16eA_4hBHTY46';

export const isProductionHost = () => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.includes('netlify.app') || host.includes('dentvision');
};
