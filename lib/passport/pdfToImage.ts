/**
 * Rasterize PDF pages to canvas/blob for OCR.
 * Auto-detects PDF by MIME or magic bytes.
 */

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

export async function pdfPagesToCanvases(
  blob: Blob,
  maxPages = 2
): Promise<HTMLCanvasElement[]> {
  const isPdf = await looksLikePdf(blob);
  if (!isPdf) {
    throw new Error('Not a PDF file');
  }

  const pdfjs = await import('pdfjs-dist');
  // Use CDN worker matching installed pdfjs version for browser builds
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await blob.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pageCount = Math.min(doc.numPages, maxPages);
  const canvases: HTMLCanvasElement[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    // Render wide enough that a small passport on an A4 sheet still has
    // readable MRZ pixels after cropping.
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(4, Math.max(2, 2400 / (base.width || 600)));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context for PDF page');

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    canvases.push(canvas);
  }

  return canvases;
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
