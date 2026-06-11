import { verifyIsCarImage } from '../services/geminiServiceAdapter';

/** Client-side gate before marking/analysis — rejects screenshots, documents, etc. */
export const validateVehiclePhotos = async (
  files: File[],
): Promise<{ accepted: File[]; rejected: boolean }> => {
  if (!files.length) return { accepted: [], rejected: true };

  const results = await Promise.all(
    files.map(async (file) => ({
      file,
      verification: await verifyIsCarImage(file),
    })),
  );

  const accepted = results.filter((r) => r.verification.is_car).map((r) => r.file);
  return { accepted, rejected: accepted.length === 0 };
};
