/**
 * Same-origin media URLs for private S3 (and other providers).
 * Browser/Next Image Optimizer fetch /api/media instead of raw S3 (avoids 403).
 */

const PUBLIC_MEDIA_PREFIXES = [
  'country-flags/',
  'country-heroes/',
  'country-banners/',
  'blog-covers/',
  'blog-inline/',
  'document-samples/',
  'visa-cards/',
  'visa-heroes/',
  'visa-gallery/',
] as const;

export function isPublicMediaKey(key: string): boolean {
  return PUBLIC_MEDIA_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function isApplicationMediaKey(key: string): boolean {
  return key.startsWith('applications/');
}

/** Validate object key for /api/media (no traversal). */
export function assertSafeMediaKey(raw: string): string {
  const trimmed = raw.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!trimmed) {
    throw new Error('Media key missing');
  }
  if (trimmed.includes('..') || trimmed.includes('\0') || /^[a-zA-Z]:/.test(trimmed)) {
    throw new Error('Invalid media key');
  }
  if (
    !isPublicMediaKey(trimmed) &&
    !isApplicationMediaKey(trimmed)
  ) {
    throw new Error('Media key not allowed');
  }
  return trimmed;
}

/** Extract object key from our S3 virtual-hosted URL (or return null). */
export function extractS3ObjectKey(url: string): string | null {
  try {
    if (!url.includes('.amazonaws.com/')) return null;
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes('.s3.') && !urlObj.hostname.endsWith('.amazonaws.com')) {
      return null;
    }
    const key = decodeURIComponent(urlObj.pathname.replace(/^\/+/, ''));
    return key || null;
  } catch {
    return null;
  }
}

/**
 * Convert a stored key or absolute S3 URL into an app-served URL.
 * Leaves Cloudinary, local /uploads, and already-proxied URLs unchanged.
 */
export function toAppMediaUrl(
  urlOrKey: string | null | undefined
): string | null {
  if (!urlOrKey) return null;
  const value = urlOrKey.trim();
  if (!value) return null;

  if (value.startsWith('/api/media')) return value;
  if (value.startsWith('/uploads/')) return value;
  if (value.includes('res.cloudinary.com')) return value;
  if (value.startsWith('blob:') || value.startsWith('data:')) return value;

  const fromS3 = extractS3ObjectKey(value);
  if (fromS3) {
    try {
      const key = assertSafeMediaKey(fromS3);
      return `/api/media?key=${encodeURIComponent(key)}`;
    } catch {
      return value;
    }
  }

  // Bare object key
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    try {
      const key = assertSafeMediaKey(value);
      return `/api/media?key=${encodeURIComponent(key)}`;
    } catch {
      return value;
    }
  }

  return value;
}

export function rewriteCountryImages<
  T extends {
    banner?: { url?: string; alt?: string; width?: number; height?: number };
    hero?: { url?: string; alt?: string; width?: number; height?: number };
    flag?: { url?: string };
  } | null | undefined,
>(images: T): T {
  if (!images) return images;
  const next = { ...images };
  if (images.banner?.url) {
    next.banner = {
      ...images.banner,
      url: toAppMediaUrl(images.banner.url) || images.banner.url,
    };
  }
  if (images.hero?.url) {
    next.hero = {
      ...images.hero,
      url: toAppMediaUrl(images.hero.url) || images.hero.url,
    };
  }
  if (images.flag?.url) {
    next.flag = {
      ...images.flag,
      url: toAppMediaUrl(images.flag.url) || images.flag.url,
    };
  }
  return next;
}
