/**
 * Inspect the passport sample corpus so pipeline changes can be measured
 * against the real layout variety users upload.
 *
 * Run: npx tsx scripts/passport-samples/inspect.ts
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const SAMPLES_DIR = path.resolve(process.cwd(), 'Passports');

interface PageReport {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  rotation: number;
  orientation: 'portrait' | 'landscape' | 'square';
  textChars: number;
  hasMrzInText: boolean;
  imageCount: number;
  images: string[];
}

async function inspectPdf(file: string, bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: bytes,
    // Node has no DOM; disable features that need one.
    disableFontFace: true,
  }).promise;

  const pages: PageReport[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const [widthPt, heightPt] = [viewport.width, viewport.height];

    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item: unknown) =>
        typeof item === 'object' && item && 'str' in item
          ? String((item as { str: string }).str)
          : ''
      )
      .join(' ');

    const operators = await page.getOperatorList();
    const images: string[] = [];
    for (let i = 0; i < operators.fnArray.length; i += 1) {
      const fn = operators.fnArray[i];
      // paintImageXObject / paintJpegXObject / paintInlineImageXObject
      if (fn === pdfjs.OPS.paintImageXObject) {
        const name = operators.argsArray[i]?.[0];
        try {
          const img: unknown = await new Promise((resolve) => {
            page.objs.get(String(name), resolve);
          });
          if (img && typeof img === 'object' && 'width' in img) {
            const { width, height } = img as { width: number; height: number };
            images.push(`${width}x${height}`);
          } else {
            images.push('unknown');
          }
        } catch {
          images.push('unreadable');
        }
      } else if (fn === pdfjs.OPS.paintInlineImageXObject) {
        const img = operators.argsArray[i]?.[0];
        images.push(img ? `${img.width}x${img.height}(inline)` : 'inline');
      }
    }

    pages.push({
      pageNumber,
      widthPt: Math.round(widthPt),
      heightPt: Math.round(heightPt),
      rotation: page.rotate,
      orientation:
        widthPt > heightPt * 1.05
          ? 'landscape'
          : heightPt > widthPt * 1.05
            ? 'portrait'
            : 'square',
      textChars: text.replace(/\s+/g, '').length,
      hasMrzInText: /P<[A-Z]{3}/.test(text.replace(/\s+/g, '')),
      imageCount: images.length,
      images: [...new Set(images)],
    });
  }

  return { file, kind: 'pdf' as const, pageCount: doc.numPages, pages };
}

function readPngSize(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpegSize(bytes: Uint8Array) {
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    // SOF0..SOF15 excluding DHT/JPG/DAC markers
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return { width, height };
    }
    offset += 2 + length;
  }
  return { width: 0, height: 0 };
}

function readExifOrientation(bytes: Uint8Array): number | null {
  let offset = 2;
  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker === 0xe1) {
      const header = Buffer.from(bytes.slice(offset + 4, offset + 10)).toString('ascii');
      if (header.startsWith('Exif')) {
        const tiff = offset + 10;
        const little = bytes[tiff] === 0x49;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const ifdOffset = view.getUint32(tiff + 4, little);
        const entries = view.getUint16(tiff + ifdOffset, little);
        for (let i = 0; i < entries; i += 1) {
          const entry = tiff + ifdOffset + 2 + i * 12;
          if (view.getUint16(entry, little) === 0x0112) {
            return view.getUint16(entry + 8, little);
          }
        }
      }
    }
    if (marker === 0xda) break;
    offset += 2 + length;
  }
  return null;
}

async function main() {
  const entries = (await readdir(SAMPLES_DIR)).filter((name) =>
    /\.(pdf|png|jpe?g)$/i.test(name)
  );

  for (const name of entries) {
    const bytes = new Uint8Array(await readFile(path.join(SAMPLES_DIR, name)));
    try {
      if (/\.pdf$/i.test(name)) {
        const report = await inspectPdf(name, bytes);
        console.log(`\n=== ${name} (PDF, ${report.pageCount} page(s)) ===`);
        for (const page of report.pages) {
          console.log(
            `  p${page.pageNumber}: ${page.widthPt}x${page.heightPt}pt ` +
              `${page.orientation} rotate=${page.rotation} ` +
              `text=${page.textChars}ch mrzInText=${page.hasMrzInText} ` +
              `images=${page.imageCount} [${page.images.join(', ')}]`
          );
        }
      } else {
        const size = /\.png$/i.test(name) ? readPngSize(bytes) : readJpegSize(bytes);
        const orientation = /\.png$/i.test(name) ? null : readExifOrientation(bytes);
        console.log(
          `\n=== ${name} (image) ===\n  ${size.width}x${size.height} ` +
            `aspect=${(size.width / size.height).toFixed(2)} ` +
            `exifOrientation=${orientation ?? 'none'}`
        );
      }
    } catch (error) {
      console.log(`\n=== ${name} === FAILED: ${(error as Error).message}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
