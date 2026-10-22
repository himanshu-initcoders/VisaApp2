/**
 * Zod schemas for application draft JSON payloads.
 */

import { z } from 'zod';

const MAX_TRAVELLERS = 12;
const MAX_PAYLOAD_BYTES = 400_000;
const MAX_STRING = 500;
const MAX_NAME = 255;

const noBinaryUrl = z
  .string()
  .max(2048)
  .refine(
    (value) => !value.startsWith('blob:') && !value.startsWith('data:'),
    'Binary preview URLs are not allowed in draft payloads'
  );

const draftFileRefSchema = z.object({
  slotKey: z.string().min(1).max(100),
  storageKey: z.string().min(1).max(500),
  url: noBinaryUrl.optional(),
  mimeType: z.string().max(100).optional(),
  filename: z.string().max(255).optional(),
  size: z.number().int().nonnegative().optional(),
});

const travellerDocumentSchema = z.object({
  key: z.string().min(1).max(100),
  name: z.string().max(255).optional(),
  mimeType: z.string().max(100).optional(),
  size: z.number().int().nonnegative().optional(),
  storedInIdb: z.boolean().optional(),
  storageKey: z.string().max(500).optional(),
  storageUrl: noBinaryUrl.optional(),
});

const draftTravellerSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().max(MAX_NAME).optional(),
    passportData: z.unknown().optional().nullable(),
    tripDetails: z.unknown().optional().nullable(),
    documents: z.array(travellerDocumentSchema).max(40).optional(),
    draftFileRefs: z.array(draftFileRefSchema).max(40).optional(),
    passportUploaded: z.boolean().optional(),
    photoUploaded: z.boolean().optional(),
    applicationComplete: z.boolean().optional(),
    editing: z.boolean().optional(),
  })
  .passthrough();

const departureSchema = z
  .object({
    mode: z.string().max(100).optional(),
    departure: z.string().max(100).optional(),
    month: z.string().max(100).optional(),
    label: z.string().max(MAX_STRING).nullable().optional(),
    priceOption: z.string().max(100).optional(),
  })
  .passthrough();

export const serverDraftPayloadSchema = z.object({
  version: z.number().int().positive().max(10),
  updatedAt: z.string().max(40),
  countryCode: z.string().min(2).max(2),
  countryName: z.string().max(MAX_NAME),
  listingId: z.string().uuid(),
  processName: z.string().max(MAX_STRING),
  step: z.string().min(1).max(50),
  primaryName: z.string().max(MAX_NAME),
  travellers: z.array(draftTravellerSchema).min(1).max(MAX_TRAVELLERS),
  departure: departureSchema,
  travellersCount: z.number().int().min(1).max(MAX_TRAVELLERS),
  interestedInInsurance: z.boolean().optional(),
});

export type ServerDraftPayloadValidated = z.infer<
  typeof serverDraftPayloadSchema
>;

export function parseServerDraftPayload(
  input: unknown
):
  | { success: true; data: ServerDraftPayloadValidated }
  | { success: false; error: string } {
  const parsed = serverDraftPayloadSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      success: false,
      error: first
        ? `${first.path.join('.') || 'payload'}: ${first.message}`
        : 'Invalid draft payload',
    };
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(parsed.data);
  } catch {
    return { success: false, error: 'Draft payload could not be serialized' };
  }
  if (serialized.length > MAX_PAYLOAD_BYTES) {
    return {
      success: false,
      error: 'Draft is too large to save. Remove large fields and try again.',
    };
  }

  return { success: true, data: parsed.data };
}

/** Collect draft storage keys from a validated (or raw) payload. */
export function collectDraftStorageKeys(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const travellers = (payload as { travellers?: unknown }).travellers;
  if (!Array.isArray(travellers)) return [];

  const keys = new Set<string>();
  for (const traveller of travellers) {
    if (!traveller || typeof traveller !== 'object') continue;
    const t = traveller as {
      draftFileRefs?: Array<{ storageKey?: string }>;
      documents?: Array<{ storageKey?: string }>;
    };
    for (const ref of t.draftFileRefs ?? []) {
      if (ref?.storageKey?.trim()) keys.add(ref.storageKey.trim());
    }
    for (const doc of t.documents ?? []) {
      if (doc?.storageKey?.trim()) keys.add(doc.storageKey.trim());
    }
  }
  return Array.from(keys);
}
