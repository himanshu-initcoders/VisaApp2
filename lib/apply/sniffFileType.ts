/**
 * Detect real file type from magic bytes. Storage keys / Content-Type lie when
 * a PDF was saved under a leftover `.jpg` slot key (or the reverse).
 */

export type SniffedFileKind = 'pdf' | 'image' | 'unknown';

export function isPdfMagic(bytes: ArrayBuffer | Uint8Array): boolean {
  const header =
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.slice(0, 5));
  return (
    header.length >= 4 &&
    header[0] === 0x25 &&
    header[1] === 0x50 &&
    header[2] === 0x44 &&
    header[3] === 0x46
  ); // %PDF
}

export function sniffFileKind(
  bytes: ArrayBuffer | Uint8Array,
  mimeHint?: string,
  filename?: string
): { kind: SniffedFileKind; mimeType: string } {
  const header =
    bytes instanceof Uint8Array
      ? bytes
      : new Uint8Array(bytes.slice(0, 16));

  if (isPdfMagic(header)) {
    return { kind: 'pdf', mimeType: 'application/pdf' };
  }

  // JPEG
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return { kind: 'image', mimeType: 'image/jpeg' };
  }
  // PNG
  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47
  ) {
    return { kind: 'image', mimeType: 'image/png' };
  }
  // WEBP (RIFF....WEBP)
  if (
    header.length >= 12 &&
    header[0] === 0x52 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x46 &&
    header[8] === 0x57 &&
    header[9] === 0x45 &&
    header[10] === 0x42 &&
    header[11] === 0x50
  ) {
    return { kind: 'image', mimeType: 'image/webp' };
  }

  const mime = (mimeHint || '').split(';')[0]?.trim().toLowerCase();
  if (mime === 'application/pdf' || /\.pdf$/i.test(filename || '')) {
    return { kind: 'pdf', mimeType: 'application/pdf' };
  }
  if (mime.startsWith('image/')) {
    return { kind: 'image', mimeType: mime };
  }
  if (/\.(jpe?g|png|webp|gif)$/i.test(filename || '')) {
    return { kind: 'image', mimeType: mime || 'image/jpeg' };
  }

  return { kind: 'unknown', mimeType: mime || 'application/octet-stream' };
}

/** Prefer filename .pdf over a lying image/* mime from a wrong storage key. */
export function isPdfPreviewSource(mimeType?: string, filename?: string) {
  if (filename && /\.pdf$/i.test(filename)) return true;
  const mime = (mimeType || '').split(';')[0]?.trim().toLowerCase();
  if (mime === 'application/pdf') return true;
  return false;
}
