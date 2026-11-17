/**
 * Warm ISR pages + public media / Next Image Optimizer caches so the first
 * visitor after deploy or admin revalidation already gets a fast hero image.
 */

import { loadEnabledCountriesWithProcesses } from '@/lib/db/queries/public';
import { toAppMediaUrl } from '@/lib/upload/mediaUrl';

const IMAGE_WIDTHS = [640, 750, 828, 1080, 1200, 1920] as const;
const IMAGE_QUALITIES = [90, 95] as const;
const CONCURRENCY = 4;

function normalizeOrigin(raw: string): string {
  // Windows often resolves `localhost` to ::1 while Next listens on IPv4 only.
  return raw
    .replace(/\/$/, '')
    .replace(/^http:\/\/localhost(?=:\d+$)/i, 'http://127.0.0.1')
    .replace(/^https:\/\/localhost(?=:\d+$)/i, 'https://127.0.0.1');
}

function publicOrigin(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  if (!raw) return null;
  return normalizeOrigin(raw);
}

function resolveHeroUrl(images?: {
  hero?: { url?: string | null };
  banner?: { url?: string | null };
} | null): string | null {
  if (!images) return null;
  const hero = images.hero?.url?.trim();
  const banner = images.banner?.url?.trim();
  const pick = hero || banner;
  if (!pick) return null;
  return toAppMediaUrl(pick) || pick;
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) {
  let index = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    async () => {
      while (index < items.length) {
        const current = items[index++];
        if (current === undefined) return;
        await worker(current);
      }
    }
  );
  await Promise.all(runners);
}

async function fetchQuiet(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      headers: { Accept: '*/*' },
    });
    return response.ok;
  } catch {
    return false;
  }
}

function optimizedImageUrls(origin: string, mediaPath: string): string[] {
  if (!mediaPath.startsWith('/')) return [];
  const encoded = encodeURIComponent(mediaPath);
  const urls: string[] = [];
  for (const width of IMAGE_WIDTHS) {
    for (const quality of IMAGE_QUALITIES) {
      urls.push(
        `${origin}/_next/image?url=${encoded}&w=${width}&q=${quality}`
      );
    }
  }
  return urls;
}

export type WarmPublicCatalogResult = {
  origin: string;
  pages: { total: number; ok: number };
  media: { total: number; ok: number };
  images: { total: number; ok: number };
};

export async function warmPublicVisaCatalog(options?: {
  countryCode?: string;
  origin?: string;
}): Promise<WarmPublicCatalogResult | null> {
  const rawOrigin = options?.origin || publicOrigin();
  const origin = rawOrigin ? normalizeOrigin(rawOrigin) : null;
  if (!origin) {
    console.warn('warmPublicVisaCatalog: no public origin configured');
    return null;
  }

  const countries = await loadEnabledCountriesWithProcesses();
  const filtered = options?.countryCode
    ? countries.filter(
        (country) =>
          country.iso2Code.toLowerCase() ===
          options.countryCode!.toLowerCase()
      )
    : countries;

  const pagePaths = new Set<string>();
  const mediaPaths = new Set<string>();

  for (const country of filtered) {
    const hero = resolveHeroUrl(country.images);
    if (hero?.startsWith('/')) mediaPaths.add(hero);

    for (const listing of country.visaListings) {
      if (listing.slug) {
        pagePaths.add(
          `/visa/${country.iso2Code.toLowerCase()}/${listing.slug}`
        );
      }
    }
  }

  const pages = [...pagePaths];
  const media = [...mediaPaths];
  const images = media.flatMap((path) => optimizedImageUrls(origin, path));

  let pagesOk = 0;
  let mediaOk = 0;
  let imagesOk = 0;

  // Pages first so ISR regenerates HTML that references the current hero URLs.
  await mapPool(pages, CONCURRENCY, async (path) => {
    if (await fetchQuiet(`${origin}${path}`)) pagesOk += 1;
  });

  await mapPool(media, CONCURRENCY, async (path) => {
    if (await fetchQuiet(`${origin}${path}`)) mediaOk += 1;
  });

  await mapPool(images, CONCURRENCY, async (url) => {
    if (await fetchQuiet(url)) imagesOk += 1;
  });

  const result: WarmPublicCatalogResult = {
    origin,
    pages: { total: pages.length, ok: pagesOk },
    media: { total: media.length, ok: mediaOk },
    images: { total: images.length, ok: imagesOk },
  };

  console.info('warmPublicVisaCatalog complete', result);
  return result;
}

/** Fire-and-forget warm after admin revalidation (never blocks the mutation). */
export function scheduleWarmPublicVisaCatalog(options?: {
  countryCode?: string;
}) {
  const origin = publicOrigin();
  if (!origin) return;
  // Skip self-warm against unreachable local hosts in some CI/build contexts.
  if (
    process.env.SKIP_PUBLIC_CATALOG_WARM === '1' ||
    process.env.NEXT_PHASE === 'phase-production-build'
  ) {
    return;
  }

  void warmPublicVisaCatalog(options).catch((error) => {
    console.warn('scheduleWarmPublicVisaCatalog failed:', error);
  });
}
