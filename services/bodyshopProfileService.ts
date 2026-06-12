import { supabase } from './supabaseClient';

const LOGO_BUCKET = 'bodyshop-logos';

export interface BodyshopProfileInput {
  businessName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  postalCode?: string;
  logoUrl?: string;
}

export const uploadBodyshopLogo = async (bodyshopId: string, file: File): Promise<{ ok: boolean; url?: string; error?: string }> => {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `${bodyshopId}/logo.${ext}`;

  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || 'image/png',
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  const url = data?.publicUrl ? `${data.publicUrl}?v=${Date.now()}` : undefined;

  if (!url) {
    return { ok: false, error: 'Could not resolve logo URL.' };
  }

  const { error: updateError } = await supabase
    .from('bodyshops' as any)
    .update({ logo_url: url })
    .eq('id', bodyshopId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true, url };
};

export const updateBodyshopProfile = async (
  bodyshopId: string,
  profile: BodyshopProfileInput,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('bodyshops' as any)
      .update({
        business_name: profile.businessName.trim(),
        address: profile.address.trim() || null,
        phone: profile.phone.trim() || null,
        email: profile.email.trim() || null,
        website: profile.website.trim() || null,
        postal_code: profile.postalCode?.trim() || null,
        logo_url: profile.logoUrl || null,
      })
      .eq('id', bodyshopId);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not save profile.',
    };
  }
};
