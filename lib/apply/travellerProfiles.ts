import { APPLY_DRAFT_PREFIX, readApplyDraft } from '@/lib/apply/draftStorage';
import type { ApplyTraveller } from '@/lib/apply/types';

export interface TravellerProfile {
  id: string;
  name: string;
  nationality: string;
  countryCode: string;
  visaType: string;
  avatarVariant: number;
  photoUploaded?: boolean;
  passportUploaded?: boolean;
  passportFrontUrl?: string;
  isSample?: boolean;
}

const PROFILES_KEY = 'visa-traveller-profiles:v1';

export const SAMPLE_TRAVELLER_PROFILES: TravellerProfile[] = [
  {
    id: 'sample-rahul',
    name: 'Rahul Sharma',
    nationality: 'India',
    countryCode: 'IN',
    visaType: 'Tourist Visa',
    avatarVariant: 0,
    isSample: true,
  },
  {
    id: 'sample-priya',
    name: 'Priya Verma',
    nationality: 'India',
    countryCode: 'IN',
    visaType: 'Business Visa',
    avatarVariant: 1,
    isSample: true,
  },
  {
    id: 'sample-amit',
    name: 'Amit Patel',
    nationality: 'India',
    countryCode: 'IN',
    visaType: 'Student Visa',
    avatarVariant: 2,
    isSample: true,
  },
  {
    id: 'sample-neha',
    name: 'Neha Singh',
    nationality: 'India',
    countryCode: 'IN',
    visaType: 'Work Visa',
    avatarVariant: 3,
    isSample: true,
  },
  {
    id: 'sample-ananya',
    name: 'Ananya Iyer',
    nationality: 'India',
    countryCode: 'IN',
    visaType: 'Tourist Visa',
    avatarVariant: 4,
    isSample: true,
  },
  {
    id: 'sample-vikram',
    name: 'Vikram Rao',
    nationality: 'India',
    countryCode: 'IN',
    visaType: 'Business Visa',
    avatarVariant: 5,
    isSample: true,
  },
];

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function avatarVariantFromName(name: string) {
  const seed = name.trim().toUpperCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 6;
}

export function formatProfileName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
}

export function formatVisaTypeLabel(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return 'Visa';
  if (/visa/i.test(trimmed)) return trimmed;
  return `${trimmed} Visa`;
}

export function profileFromTraveller(
  traveller: ApplyTraveller,
  visaType: string
): TravellerProfile | null {
  const name = formatProfileName(traveller.name);
  if (!name) return null;

  return {
    id: `saved-${name.replace(/\s+/g, '-').toLowerCase()}`,
    name,
    nationality: 'India',
    countryCode: 'IN',
    visaType: formatVisaTypeLabel(visaType) || 'Visa',
    avatarVariant: avatarVariantFromName(name),
    photoUploaded: traveller.photoUploaded,
    passportUploaded: traveller.passportUploaded,
    passportFrontUrl: traveller.passportFrontUrl,
  };
}

function readSavedProfiles(): TravellerProfile[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TravellerProfile[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item?.name);
  } catch {
    return [];
  }
}

function writeSavedProfiles(profiles: TravellerProfile[]) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles.slice(0, 20)));
  } catch {
    // private mode / quota
  }
}

export function saveTravellerProfile(profile: TravellerProfile) {
  if (profile.isSample) return;
  const current = readSavedProfiles();
  const next = [
    { ...profile, isSample: false },
    ...current.filter(
      (item) => item.name.trim().toUpperCase() !== profile.name.trim().toUpperCase()
    ),
  ];
  writeSavedProfiles(next);
}

function profilesFromDrafts(): TravellerProfile[] {
  if (!canUseStorage()) return [];
  const found: TravellerProfile[] = [];
  const seen = new Set<string>();

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(APPLY_DRAFT_PREFIX)) continue;
      const listingId = key.slice(APPLY_DRAFT_PREFIX.length);
      const draft = readApplyDraft(listingId);
      if (!draft) continue;

      for (const traveller of draft.travellers) {
        const profile = profileFromTraveller(traveller, draft.processName);
        if (!profile) continue;
        const token = profile.name.toUpperCase();
        if (seen.has(token)) continue;
        seen.add(token);
        found.push(profile);
      }
    }
  } catch {
    return found;
  }

  return found;
}

export function listTravellerProfiles(): TravellerProfile[] {
  const merged = new Map<string, TravellerProfile>();

  for (const profile of [...readSavedProfiles(), ...profilesFromDrafts()]) {
    const token = profile.name.trim().toUpperCase();
    if (!token || merged.has(token)) continue;
    merged.set(token, {
      ...profile,
      isSample: false,
      visaType: formatVisaTypeLabel(profile.visaType),
    });
  }

  const saved = [...merged.values()];
  const extras = SAMPLE_TRAVELLER_PROFILES.filter((sample) => {
    const token = sample.name.trim().toUpperCase();
    return !merged.has(token);
  });
  return [...saved, ...extras];
}
