/**
 * Rasterize PDF pages to canvas/blob for OCR.
 *
 * Users upload anything from a single cropped data page to a 10-page scan of
 * the whole booklet, so pages are rendered in two phases: every page cheaply
 * for triage, then only the chosen pages at OCR resolution.
 */

import { passportRuntime } from './runtime';

/** Enough to cover a full booklet scan without letting one upload run away. */
export const MAX_PDF_PAGES = 24;

export function isPdfFile(input: File | Blob): boolean {
  if (input.type === 'application/pdf') return true;
  if (input instanceof File && /\.pdf$/i.test(input.name)) return true;
  return false;
}

async function looksLikePdf(blob: Blob): Promise<boolean> {
  if (isPdfFile(blob)) return true;
  const header = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  return (
    header[0] === 0x25 &&
    header[1] === 0x50 &&
    header[2] === 0x44 &&
    header[3] === 0x46
  );
}

export interface RasterizedPage {
  /** 1-based, matching the page number the user sees in a PDF reader. */
  pageNumber: number;
  canvas: HTMLCanvasElement;
  /**
   * Embedded text layer, when present. Often a scanner's own baked-in OCR
   * rather than clean digital text, so treat it as a hint and never as truth.
   */
  textLayer: string;
}

export interface PdfRenderOptions {
  /** 1-based page numbers to render. Omit to render every page. */
  pages?: number[];
  /** Longest edge of each output canvas, in pixels. */
  maxEdge?: number;
}

type LoadingTask = ReturnType<(typeof import('pdfjs-dist'))['getDocument']>;

/**
 * The legacy build, deliberately.
 *
 * The default build assumes a very recent engine — it calls
 * `Uint8Array.prototype.toHex`, which only landed in browsers during 2025 — so
 * on an older Android Chrome the whole PDF path dies with a TypeError. Most of
 * our applicants are on mid-range Android phones, and the legacy build is
 * transpiled and polyfilled for exactly that. It also lets the same code run
 * server-side under Node.
 */
async function loadPdfjs() {
  return import('pdfjs-dist/legacy/build/pdf.mjs') as unknown as Promise<
    typeof import('pdfjs-dist')
  >;
}

/**
 * `destroy()` lives on the loading task, not the document, so the task is
 * returned alongside — dropping it leaks the pdf.js worker for the session.
 */
async function openPdf(blob: Blob): Promise<LoadingTask> {
  if (!(await looksLikePdf(blob))) {
    throw new Error('Not a PDF file');
  }

  // Assets come from our own origin. A CDN reference would break passport
  // scanning under a strict CSP or offline, and the wasm decoders are required
  // for JBIG2 / JPEG2000 scans — without them those pages render blank and OCR
  // reads nothing at all.
  const { pdfjsAssets } = passportRuntime();
  const pdfjs = await loadPdfjs();
  pdfjs.GlobalWorkerOptions.workerSrc = `${pdfjsAssets}pdf.worker.min.mjs`;

  const data = new Uint8Array(await blob.arrayBuffer());
  return pdfjs.getDocument({
    data,
    wasmUrl: `${pdfjsAssets}wasm/`,
    standardFontDataUrl: `${pdfjsAssets}standard_fonts/`,
    cMapUrl: `${pdfjsAssets}cmaps/`,
    cMapPacked: true,
  });
}

/**
 * Render the requested pages. `getViewport` applies the page's /Rotate entry,
 * so scanner output flagged as landscape comes back already upright — content
 * rotated inside the page still needs the orientation search.
 */
export async function rasterizePdfPages(
  blob: Blob,
  options?: PdfRenderOptions
): Promise<RasterizedPage[]> {
  const maxEdge = options?.maxEdge ?? 2400;
  const task = await openPdf(blob);
  const doc = await task.promise;

  try {
    const pageNumbers = (
      options?.pages ??
      Array.from({ length: doc.numPages }, (_, index) => index + 1)
    )
      .filter((pageNumber) => pageNumber >= 1 && pageNumber <= doc.numPages)
      .slice(0, MAX_PDF_PAGES);

    const rendered: RasterizedPage[] = [];

    for (const pageNumber of pageNumbers) {
      const page = await doc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(4, maxEdge / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale: Math.max(scale, 0.1) });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas context for PDF page');
      // Scans are white paper; an unpainted canvas is transparent black and
      // would invert the Otsu threshold on any page with margins.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      let textLayer = '';
      try {
        const content = await page.getTextContent();
        textLayer = content.items
          .map((item) =>
            typeof item === 'object' && item && 'str' in item
              ? (item as { str: string }).str
              : ''
          )
          .join(' ');
      } catch {
        textLayer = '';
      }

      rendered.push({ pageNumber, canvas, textLayer });
    }

    return rendered;
  } finally {
    await task.destroy();
  }
}

/** Page count without rasterizing anything. */
export async function pdfPageCount(blob: Blob): Promise<number> {
  const task = await openPdf(blob);
  try {
    return (await task.promise).numPages;
  } finally {
    await task.destroy();
  }
}

export async function pdfPagesToCanvases(
  blob: Blob,
  maxPages = MAX_PDF_PAGES
): Promise<HTMLCanvasElement[]> {
  const pages = await rasterizePdfPages(blob, {
    pages: Array.from({ length: maxPages }, (_, index) => index + 1),
  });
  return pages.map((page) => page.canvas);
}

export async function blobToImageUrl(blob: Blob): Promise<string> {
  return URL.createObjectURL(blob);
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/jpeg',
  quality = 0.92
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Failed to convert canvas to blob'));
        else resolve(blob);
      },
      type,
      quality
    );
  });
}
