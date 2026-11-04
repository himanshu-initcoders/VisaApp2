/**
 * When object keys include a file extension, replacing a slot with a different
 * MIME (e.g. jpg → pdf) leaves the previous key as an orphan on S3/local.
 * Cloudinary uses extension-stripped public_ids, so sibling cleanup is skipped.
 */

import { uploadService } from '@/lib/upload';

const SLOT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'] as const;

/** Delete other known extensions for the same slot path (not the kept key). */
export async function deleteOtherSlotExtensionKeys(
  keptObjectKey: string
): Promise<void> {
  if (uploadService.getProviderName() === 'cloudinary') return;

  const match = keptObjectKey.match(/^(.*)\.([^.]+)$/);
  if (!match) return;

  const base = match[1]!;
  const currentExt = match[2]!.toLowerCase();

  await Promise.all(
    SLOT_EXTENSIONS.filter((ext) => ext !== currentExt).map(async (ext) => {
      try {
        await uploadService.delete({ key: `${base}.${ext}` });
      } catch {
        // Missing alternate keys are expected.
      }
    })
  );
}

/** Delete a previous object key when it differs from the replacement. */
export async function deleteReplacedObjectKey(
  previousKey: string | null | undefined,
  nextKey: string
): Promise<void> {
  if (!previousKey || previousKey === nextKey) return;
  try {
    await uploadService.delete({ key: previousKey });
  } catch (error) {
    console.warn('[Upload] Failed to delete replaced key:', previousKey, error);
  }
}
