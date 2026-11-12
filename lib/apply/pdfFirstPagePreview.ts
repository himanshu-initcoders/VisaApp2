/**
 * Rasterize page 1 of a PDF into a blob URL for card / modal thumbnails.
 * Reuses passport pdf.js path so scans with JBIG2/JPEG2000 still render.
 */

import {
  canvasToBlob,
  rasterizePdfPages,
} from '@/lib/passport/pdfToImage';
import { isPdfMagic, isPdfPreviewSource } from '@/lib/apply/sniffFileType';

export { isPdfPreviewSource };

export async function createPdfFirstPagePreviewUrl(
  source: string | Blob,
  options?: { maxEdge?: number }
): Promise<string | null> {
  try {
    const blob =
      typeof source === 'string'
        ? await (await fetch(source)).blob()
        : source;
    const header = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    if (!isPdfMagic(header) && blob.type !== 'application/pdf') {
      // Still try rasterize — looksLikePdf in pdfToImage also checks magic.
    }
    const pages = await rasterizePdfPages(blob, {
      pages: [1],
      maxEdge: options?.maxEdge ?? 900,
    });
    const page = pages[0];
    if (!page) return null;
    return URL.createObjectURL(
      await canvasToBlob(page.canvas, 'image/jpeg', 0.85)
    );
  } catch {
    return null;
  }
}
