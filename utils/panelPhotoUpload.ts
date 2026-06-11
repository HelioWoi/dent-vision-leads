import { PanelType } from '../types';
import { verifyIsCarImage } from '../services/geminiServiceAdapter';

export const PHOTOS_PER_PANEL = 3;

export const PHOTO_SLOT_HINTS = [
  { label: 'Close-up', hint: 'Dent detail' },
  { label: 'Angled', hint: 'Side angle' },
  { label: 'Wide', hint: 'Full panel' },
] as const;

export interface PanelPhotoGroup {
  panel: PanelType;
  photos: File[];
}

const imageDimensions = (file: File): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });

/** Score a candidate photo — higher is better for dent analysis. */
export const scorePhotoForAnalysis = async (file: File): Promise<number> => {
  try {
    const [{ is_car }, dims] = await Promise.all([
      verifyIsCarImage(file),
      imageDimensions(file),
    ]);
    if (!is_car) return -1;
    const pixels = dims.width * dims.height;
    const minSide = Math.min(dims.width, dims.height);
    if (minSide < 400) return pixels * 0.5;
    if (minSide < 720) return pixels * 0.85;
    return pixels;
  } catch {
    return -1;
  }
};

/** Pick the best photo per panel when the user uploaded multiple angles. */
export const selectBestPhotosPerPanel = async (
  groups: PanelPhotoGroup[],
): Promise<{ files: File[]; panels: PanelType[] }> => {
  const selected: { file: File; panel: PanelType }[] = [];

  for (const group of groups) {
    if (!group.photos.length) continue;
    if (group.photos.length === 1) {
      selected.push({ file: group.photos[0], panel: group.panel });
      continue;
    }

    const scored = await Promise.all(
      group.photos.map(async (file) => ({
        file,
        score: await scorePhotoForAnalysis(file),
      })),
    );
    const ranked = scored
      .filter((s) => s.score >= 0)
      .sort((a, b) => b.score - a.score);

    selected.push({
      file: ranked[0]?.file ?? group.photos[0],
      panel: group.panel,
    });
  }

  return {
    files: selected.map((s) => s.file),
    panels: selected.map((s) => s.panel),
  };
};
