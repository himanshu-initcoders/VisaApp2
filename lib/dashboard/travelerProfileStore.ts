/**
 * Persist and merge traveler_profiles for the document vault.
 * Profiles are created only when name + DOB + passport are present.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { documents } from '@/lib/db/schema';
import {
  travelerProfiles,
  type TravelerProfileRow,
} from '@/lib/db/schema-traveler-profiles';
import {
  displayTravelerName,
  travelerIdentityParts,
  travelerProfileKey,
  type IdentityTraveller,
} from '@/lib/dashboard/travelerIdentity';

type DbLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  select: (...args: any[]) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insert: (...args: any[]) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: (...args: any[]) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete: (...args: any[]) => any;
};

export type ProfileTravellerInput = IdentityTraveller;

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePassport(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function profileFields(traveller: ProfileTravellerInput) {
  const parts = travelerIdentityParts(traveller);
  const passport = traveller.passportData || {};
  return {
    name: (parts?.name
      ? displayTravelerName(traveller) || parts.name
      : displayTravelerName(traveller)
    ).slice(0, 255),
    passportNumber: parts?.passportNumber || null,
    dateOfBirth: parts?.dateOfBirth || null,
    nationality: str(passport.nationality).slice(0, 100) || null,
    sex: str(passport.sex).slice(0, 20) || null,
  };
}

export class IncompleteTravelerIdentityError extends Error {
  constructor(message = 'Traveler identity requires name, date of birth, and passport number') {
    super(message);
    this.name = 'IncompleteTravelerIdentityError';
  }
}

/**
 * Ensure a traveler_profiles row exists for this traveller identity.
 * Throws IncompleteTravelerIdentityError when name/DOB/passport are missing.
 */
export async function ensureTravelerProfile(
  tx: DbLike,
  userId: string,
  traveller: ProfileTravellerInput
): Promise<TravelerProfileRow> {
  const identityKey = travelerProfileKey(traveller);
  if (!identityKey) {
    throw new IncompleteTravelerIdentityError();
  }

  const fields = profileFields(traveller);
  const now = new Date();

  const [existing] = await tx
    .select()
    .from(travelerProfiles)
    .where(
      and(
        eq(travelerProfiles.userId, userId),
        eq(travelerProfiles.identityKey, identityKey)
      )
    )
    .limit(1);

  if (existing) {
    const [updated] = await tx
      .update(travelerProfiles)
      .set({
        name: fields.name || existing.name,
        passportNumber: fields.passportNumber || existing.passportNumber,
        dateOfBirth: fields.dateOfBirth || existing.dateOfBirth,
        nationality: fields.nationality || existing.nationality,
        sex: fields.sex || existing.sex,
        updatedAt: now,
      })
      .where(eq(travelerProfiles.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await tx
    .insert(travelerProfiles)
    .values({
      userId,
      identityKey,
      name: fields.name || 'Traveller',
      passportNumber: fields.passportNumber,
      dateOfBirth: fields.dateOfBirth,
      nationality: fields.nationality,
      sex: fields.sex,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

/** @deprecated Use ensureTravelerProfile */
export const ensurePassengerProfile = ensureTravelerProfile;

/** Look up a profile by id for the owning user. */
export async function getTravelerProfileForUser(
  tx: DbLike,
  userId: string,
  profileId: string
): Promise<TravelerProfileRow | null> {
  const [row] = await tx
    .select()
    .from(travelerProfiles)
    .where(
      and(
        eq(travelerProfiles.id, profileId),
        eq(travelerProfiles.userId, userId)
      )
    )
    .limit(1);
  return row ?? null;
}

/** @deprecated Use getTravelerProfileForUser */
export const getPassengerProfileForUser = getTravelerProfileForUser;

export async function listTravelerProfilesForUser(
  tx: DbLike,
  userId: string
): Promise<TravelerProfileRow[]> {
  return tx
    .select()
    .from(travelerProfiles)
    .where(eq(travelerProfiles.userId, userId));
}

/** @deprecated Use listTravelerProfilesForUser */
export const listPassengerProfilesForUser = listTravelerProfilesForUser;

export async function listProfilesByIds(
  tx: DbLike,
  ids: string[]
): Promise<TravelerProfileRow[]> {
  if (ids.length === 0) return [];
  return tx
    .select()
    .from(travelerProfiles)
    .where(inArray(travelerProfiles.id, ids));
}

export type UpdateTravelerProfileFieldsInput = {
  name: string;
  passportNumber: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  sex: string | null;
};

/**
 * Update profile demographics. Recomputes identityKey when name/DOB/passport change.
 * Rejects incomplete identity or conflicts with another profile.
 */
export async function updateTravelerProfileFields(
  tx: DbLike,
  userId: string,
  profileId: string,
  input: UpdateTravelerProfileFieldsInput
): Promise<
  | { ok: true; profile: TravelerProfileRow }
  | { ok: false; error: string }
> {
  const existing = await getTravelerProfileForUser(tx, userId, profileId);
  if (!existing) return { ok: false, error: 'Profile not found' };

  const name = input.name.trim().slice(0, 255) || existing.name;
  const passportNumber = input.passportNumber
    ? normalizePassport(input.passportNumber)
    : null;
  const dateOfBirth = input.dateOfBirth?.trim().slice(0, 32) || null;
  const nationality = input.nationality?.trim().slice(0, 100) || null;
  const sex = input.sex?.trim().slice(0, 20) || null;

  const nextIdentity = travelerProfileKey({
    name,
    passportData: {
      passportNumber: passportNumber || undefined,
      dateOfBirth: dateOfBirth || undefined,
      nationality: nationality || undefined,
      sex: sex || undefined,
    },
  });

  if (!nextIdentity) {
    return {
      ok: false,
      error: 'Name, date of birth, and passport number are required',
    };
  }

  if (nextIdentity !== existing.identityKey) {
    const [conflict] = await tx
      .select({ id: travelerProfiles.id })
      .from(travelerProfiles)
      .where(
        and(
          eq(travelerProfiles.userId, userId),
          eq(travelerProfiles.identityKey, nextIdentity)
        )
      )
      .limit(1);
    if (conflict && conflict.id !== profileId) {
      return {
        ok: false,
        error: 'Another traveler profile already uses this identity',
      };
    }
  }

  const now = new Date();
  const [updated] = await tx
    .update(travelerProfiles)
    .set({
      name,
      passportNumber,
      dateOfBirth,
      nationality,
      sex,
      identityKey: nextIdentity,
      updatedAt: now,
    })
    .where(eq(travelerProfiles.id, profileId))
    .returning();

  return { ok: true, profile: updated ?? existing };
}

/** @deprecated Use updateTravelerProfileFields */
export const updatePassengerProfileFields = updateTravelerProfileFields;

/**
 * Soft-unlink documents then delete blank/provisional profiles.
 * Also migrates legacy pp:/nd: keys to npd: when name+DOB+passport exist.
 */
export async function deleteBlankTravelerProfiles(
  tx: DbLike,
  userId?: string
): Promise<{ deleted: number; migrated: number }> {
  const rows = userId
    ? await tx
        .select()
        .from(travelerProfiles)
        .where(eq(travelerProfiles.userId, userId))
    : await tx.select().from(travelerProfiles);

  let deleted = 0;
  let migrated = 0;
  for (const row of rows as TravelerProfileRow[]) {
    if (row.identityKey.startsWith('npd:')) continue;

    const nextKey = travelerProfileKey({
      name: row.name,
      passportData: {
        passportNumber: row.passportNumber || undefined,
        dateOfBirth: row.dateOfBirth || undefined,
        nationality: row.nationality || undefined,
        sex: row.sex || undefined,
      },
    });

    if (nextKey) {
      const [conflict] = await tx
        .select({ id: travelerProfiles.id })
        .from(travelerProfiles)
        .where(
          and(
            eq(travelerProfiles.userId, row.userId),
            eq(travelerProfiles.identityKey, nextKey)
          )
        )
        .limit(1);

      if (conflict && conflict.id !== row.id) {
        await tx
          .update(documents)
          .set({ profileId: conflict.id })
          .where(eq(documents.profileId, row.id));
        await tx
          .delete(travelerProfiles)
          .where(eq(travelerProfiles.id, row.id));
        deleted += 1;
        continue;
      }

      await tx
        .update(travelerProfiles)
        .set({ identityKey: nextKey, updatedAt: new Date() })
        .where(eq(travelerProfiles.id, row.id));
      migrated += 1;
      continue;
    }

    const isBlank =
      row.identityKey.startsWith('id:') ||
      row.name === 'Traveller' ||
      !row.passportNumber ||
      !row.dateOfBirth;

    if (!isBlank) continue;

    await tx
      .update(documents)
      .set({ profileId: null })
      .where(eq(documents.profileId, row.id));
    await tx.delete(travelerProfiles).where(eq(travelerProfiles.id, row.id));
    deleted += 1;
  }
  return { deleted, migrated };
}
