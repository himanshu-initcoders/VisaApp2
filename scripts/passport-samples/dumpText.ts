/**
 * Dump the PDF text layer for a sample, to see whether a digital-text
 * fast path can replace OCR entirely.
 *
 * Run: npx tsx scripts/passport-samples/dumpText.ts "Sunil Karpe Passport.pdf"
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function main() {
  const name = process.argv[2];
  if (!name) throw new Error('Pass a sample file name');

  const bytes = new Uint8Array(
    await readFile(path.resolve(process.cwd(), 'Passports', name))
  );
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
  }).promise;

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    console.log(`\n----- page ${pageNumber} (rotate=${page.rotate}) -----`);
    for (const item of content.items) {
      if (typeof item === 'object' && item && 'str' in item) {
        const it = item as { str: string; transform: number[]; hasEOL: boolean };
        if (!it.str.trim()) continue;
        console.log(
          `[x=${it.transform[4].toFixed(0)} y=${it.transform[5].toFixed(0)}] ${it.str}`
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
