import { verifyIsCarImage } from '../services/geminiServiceAdapter';

export interface ValidatePhotosResult {
  accepted: File[];
  rejected: boolean;
  /** True when verify API failed — caller may proceed and let deep analysis decide. */
  verifySkipped?: boolean;
}

const verifyApiUnavailable = (reason?: string) =>
  /could not verify/i.test(reason || '');

/** Shared verify gate — used before marking and again before analysis. */
export const filterVerifiedVehiclePhotos = async (
  files: File[],
  options?: { userMarkedDamage?: boolean },
): Promise<{ files: File[]; verifySkipped: boolean }> => {
  if (!files.length) return { files: [], verifySkipped: false };

  const results = await Promise.all(
    files.map(async (file) => ({
      file,
      verification: await verifyIsCarImage(file),
    })),
  );

  const accepted = results.filter((r) => r.verification.is_car).map((r) => r.file);
  if (accepted.length > 0) {
    return { files: accepted, verifySkipped: false };
  }

  const verifyApiFailed = results.every((r) =>
    verifyApiUnavailable(r.verification.reason),
  );
  if (verifyApiFailed || options?.userMarkedDamage) {
    return { files, verifySkipped: true };
  }

  return { files: [], verifySkipped: false };
};

/** Client-side gate before marking — rejects screenshots/documents; skips block on API outage. */
export const validateVehiclePhotos = async (
  files: File[],
): Promise<ValidatePhotosResult> => {
  if (!files.length) return { accepted: [], rejected: true };

  const { files: accepted, verifySkipped } = await filterVerifiedVehiclePhotos(files);
  if (accepted.length > 0) {
    return { accepted, rejected: false, verifySkipped };
  }

  return { accepted: [], rejected: true };
};
