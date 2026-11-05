/**
 * Same-origin media URLs for private S3 (and other providers).
 * Browser/Next Image Optimizer fetch /api/media instead of raw S3 (avoids 403).
 * Also rewrites legacy /uploads/* so Content-Type is sniffed (extensionless AVIF etc.).
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
  if (!isPublicMediaKey(trimmed) && !isApplicationMediaKey(trimmed)) {
    throw new Error('Media key not allowed');
  }
  return trimmed;
}

function mediaProxyUrl(key: string): string {
  return `/api/media?key=${encodeURIComponent(key)}`;
}

/** Extract object key from our S3 virtual-hosted or path-style URL (or return null). */
export function extractS3ObjectKey(url: string): string | null {
  try {
    if (!url.includes('amazonaws.com')) return null;
    const urlObj = new URL(url);
    const host = urlObj.hostname.toLowerCase();
    if (!host.includes('amazonaws.com')) return null;

    let key = decodeURIComponent(urlObj.pathname.replace(/^\/+/, ''));
    if (!key) return null;

    // Path-style: s3.region.amazonaws.com/bucket/key or s3.amazonaws.com/bucket/key
    if (
      host.startsWith('s3.') ||
      host === 's3.amazonaws.com' ||
      /^s3-\w/.test(host)
    ) {
      const slash = key.indexOf('/');
      if (slash === -1) return null;
      key = key.slice(slash + 1);
    }

    return key || null;
  } catch {
    return null;
  }
}

/**
 * Sniff MIME from magic bytes when the object key has no (or wrong) extension.
 * Extensionless AVIF flags were being served as application/octet-stream.
 */
export function sniffMediaContentType(
  buffer: Buffer | Uint8Array
): string | null {
  if (!buffer || buffer.length < 12) return null;
  const b = buffer instanceof Buffer ? buffer : Buffer.from(buffer);

  // %PDF
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
    return 'application/pdf';
  }
  // JPEG
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47
  ) {
    return 'image/png';
  }
  // GIF
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    return 'image/gif';
  }
  // WebP: RIFF....WEBP
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return 'image/webp';
  }
  // AVIF / HEIC: ....ftyp....
  if (
    b[4] === 0x66 &&
    b[5] === 0x74 &&
    b[6] === 0x79 &&
    b[7] === 0x70
  ) {
    const brand = b.slice(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (brand === 'heic' || brand === 'heix' || brand === 'mif1' || brand === 'msf1') {
      return 'image/heic';
    }
  }
  return null;
}

/**
 * Convert a stored key or absolute S3 /uploads URL into an app-served URL.
 * Leaves Cloudinary, Atlys CDN, blob/data, and already-proxied URLs unchanged.
 */
export function toAppMediaUrl(
  urlOrKey: string | null | undefined
): string | null {
  if (!urlOrKey) return null;
  const value = urlOrKey.trim();
  if (!value) return null;

  if (value.startsWith('/api/media')) return value;
  if (value.startsWith('blob:') || value.startsWith('data:')) return value;
  if (value.includes('res.cloudinary.com')) return value;
  if (value.includes('media.atlys.com')) return value;

  // Legacy local public URLs → proxy (correct Content-Type + S3 fallback)
  if (value.startsWith('/uploads/')) {
    const keyPart = value.slice('/uploads/'.length).split('?')[0];
    try {
      return mediaProxyUrl(assertSafeMediaKey(keyPart));
    } catch {
      return value;
    }
  }

  const fromS3 = extractS3ObjectKey(value);
  if (fromS3) {
    try {
      return mediaProxyUrl(assertSafeMediaKey(fromS3));
    } catch {
      return value;
    }
  }

  // Bare object key
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    try {
      return mediaProxyUrl(assertSafeMediaKey(value));
    } catch {
      return value;
    }
  }

  return value;
}

/** True when the URL/key points at an SVG (next/image cannot optimize these). */
export function isSvgMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const value = url.trim();
  if (!value) return false;
  try {
    if (value.includes('/api/media')) {
      const absolute =
        value.startsWith('http://') || value.startsWith('https://')
          ? value
          : `http://local.invalid${value.startsWith('/') ? '' : '/'}${value}`;
      const key = new URL(absolute).searchParams.get('key') || '';
      return /\.svg$/i.test(key);
    }
  } catch {
    // fall through
  }
  return /\.svg(?:\?|#|$)/i.test(value);
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
