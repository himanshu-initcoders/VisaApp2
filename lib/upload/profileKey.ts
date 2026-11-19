/**
 * Object keys for profile-owned document vault uploads.
 *
 * users/{userId}/profiles/{profileId}/{slotKey}[__{revision}].{ext}
 */

import {
  sanitizeExtension,
  sanitizePathSegment,
  sanitizeSlotKey,
} from '@/lib/upload/applicationKey';

export const PROFILE_UPLOAD_FOLDER = 'users';

export interface ProfileObjectKeyInput {
  userId: string;
  profileId: string;
  slotKey: string;
  ext: string;
  revision?: string;
}

export function buildProfileObjectKey(input: ProfileObjectKeyInput): string {
  const userId = sanitizePathSegment(input.userId);
  const profileId = sanitizePathSegment(input.profileId);
  const slotKey = sanitizeSlotKey(input.slotKey);
  const ext = sanitizeExtension(input.ext);
  const revision = input.revision
    ? `__${sanitizePathSegment(input.revision)}`
    : '';

  return [
    'users',
    userId,
    'profiles',
    profileId,
    `${slotKey}${revision}.${ext}`,
  ].join('/');
}

/** True when key belongs to this user's profile vault. */
export function isProfileObjectKey(key: string, userId: string): boolean {
  const userSeg = sanitizePathSegment(userId);
  return key.startsWith(`users/${userSeg}/profiles/`);
}

export function extractProfileIdFromObjectKey(key: string): string | null {
  const match = key.match(/\/profiles\/([^/]+)\//);
  return match?.[1] ?? null;
}
