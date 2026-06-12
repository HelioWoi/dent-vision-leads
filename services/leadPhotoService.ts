import { supabase } from './supabaseClient';

const BUCKET = 'lead-photos';

export const uploadLeadPhotos = async (files: File[]): Promise<string[]> => {
  if (!files.length) return [];

  const urls: string[] = [];
  const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  for (let i = 0; i < Math.min(files.length, 4); i++) {
    const file = files[i];
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${batchId}/${i + 1}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg',
    });

    if (error) {
      console.warn('[lead-photos] upload failed', path, error.message);
      continue;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (data?.publicUrl) urls.push(data.publicUrl);
  }

  return urls;
};
