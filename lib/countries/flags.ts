/**
 * Batch-resolve country flag image URLs by ISO2 code.
 */

import { inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { countries } from '@/lib/db/schema-extended';

function normalizeCodes(
  codes: Iterable<string | null | undefined>
): string[] {
  const set = new Set<string>();
  for (const raw of codes) {
    const code = (raw || '').trim().toUpperCase();
    if (code.length === 2) set.add(code);
  }
  return Array.from(set);
}

/**
 * Returns a map of ISO2 → flag URL (or null when missing).
 */
export async function getCountryFlagMap(
  codes: Iterable<string | null | undefined>
): Promise<Record<string, string | null>> {
  const iso2Codes = normalizeCodes(codes);
  if (iso2Codes.length === 0) return {};

  const rows = await db
    .select({
      iso2Code: countries.iso2Code,
      images: countries.images,
    })
    .from(countries)
    .where(inArray(countries.iso2Code, iso2Codes));

  const map: Record<string, string | null> = {};
  for (const code of iso2Codes) {
    map[code] = null;
  }
  for (const row of rows) {
    const url = row.images?.flag?.url?.trim() || null;
    map[row.iso2Code.toUpperCase()] = url;
  }
  return map;
}

export function flagUrlFor(
  flagMap: Record<string, string | null> | undefined,
  countryCode?: string | null
): string | null {
  if (!flagMap || !countryCode) return null;
  return flagMap[countryCode.trim().toUpperCase()] ?? null;
}
