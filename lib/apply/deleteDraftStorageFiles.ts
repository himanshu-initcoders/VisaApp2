/**
 * Delete object-storage files referenced by an application draft payload.
 */

import { uploadService } from '@/lib/upload';
import { collectDraftStorageKeys } from '@/lib/validations/draft';
import { assertSafeStorageKey } from '@/lib/upload/safeStorageKey';

export async function deleteDraftStorageFiles(
  payload: unknown
): Promise<void> {
  const keys = collectDraftStorageKeys(payload);
  await Promise.all(
    keys.map(async (key) => {
      try {
        const safeKey = assertSafeStorageKey(key);
        await uploadService.delete({ key: safeKey });
      } catch (error) {
        console.warn('[Draft] Failed to delete storage file:', key, error);
      }
    })
  );
}
