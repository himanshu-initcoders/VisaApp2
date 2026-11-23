/**
 * Static world-country catalog (name + ISO2) and local flag asset helpers.
 */

import countriesJson from '@/lib/countries.json';

export type CatalogCountry = {
  name: string;
  /** Lowercase ISO 3166-1 alpha-2 */
  code: string;
};

export const WORLD_COUNTRIES = countriesJson as CatalogCountry[];

const byCode = new Map(
  WORLD_COUNTRIES.map((c) => [c.code.toUpperCase(), c] as const)
);

/** Public path for flag image: `/flags/{iso2}.webp` */
export function getLocalFlagUrl(iso2Code: string): string {
  return `/flags/${iso2Code.trim().toLowerCase()}.webp`;
}

export function getCountryByCode(iso2Code: string): CatalogCountry | undefined {
  return byCode.get(iso2Code.trim().toUpperCase());
}

export function getCountryName(iso2Code: string): string {
  return getCountryByCode(iso2Code)?.name ?? iso2Code.toUpperCase();
}

/**
 * Case-insensitive search by name or ISO2 code.
 * Empty query returns the first available countries (for browse-on-focus).
 */
export function searchCountries(
  query: string,
  options?: {
    excludeCodes?: Iterable<string>;
    limit?: number;
  }
): CatalogCountry[] {
  const q = query.trim().toLowerCase();
  const exclude = new Set(
    Array.from(options?.excludeCodes ?? []).map((c) => c.trim().toUpperCase())
  );
  const limit = options?.limit ?? 12;

  const matches: CatalogCountry[] = [];
  for (const country of WORLD_COUNTRIES) {
    if (exclude.has(country.code.toUpperCase())) continue;
    if (!q) {
      matches.push(country);
    } else {
      const name = country.name.toLowerCase();
      const code = country.code.toLowerCase();
      if (name.includes(q) || code.includes(q) || code === q) {
        matches.push(country);
      }
    }
    if (matches.length >= limit) break;
  }
  return matches;
}
