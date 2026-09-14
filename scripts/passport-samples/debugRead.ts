/**
 * Run: npx tsx scripts/passport-samples/debugRead.ts "Rekha_Pradeep_Passport.jpeg"
 */
import './nodeCanvas';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { configurePassportRuntime } from '../../lib/passport/runtime';

configurePassportRuntime({
  pdfjsAssets: `${new URL('file://')}${path
    .resolve(process.cwd(), 'public/pdfjs')
    .replace(/\\/g, '/')}/`,
  tessdataPath: path.resolve(process.cwd(), 'public/tessdata'),
  tesseractWorkerPath: undefined,
});

async function main() {
  const name = process.argv[2];
  if (!name) throw new Error('Pass a sample file name');

  const { selectCandidatePages } = await import('../../lib/passport/pipeline');
  const { detectMrzRegion, ocrText, findTd3MrzLines } = await import(
    '../../lib/passport/extractIndianPassport'
  );
  const { createPassportOcr } = await import('../../lib/passport/ocr');

  const bytes = await readFile(path.join(process.cwd(), 'Passports', name));
  const blob = new Blob([bytes], {
    type: /\.png$/i.test(name)
      ? 'image/png'
      : /\.pdf$/i.test(name)
        ? 'application/pdf'
        : 'image/jpeg',
  });

  const outDir = path.resolve(process.cwd(), 'scripts/passport-samples/debug');
  await mkdir(outDir, { recursive: true });

  const candidates = await selectCandidatePages(blob);
  const ocr = await createPassportOcr();
  try {
    for (const [index, candidate] of candidates.slice(0, 2).entries()) {
      const mrzCanvas = detectMrzRegion(candidate.canvas);
      const enc = mrzCanvas as unknown as { encode?: (fmt: string) => Promise<Buffer> };
      if (enc.encode) {
        await writeFile(
          path.join(outDir, `mrz-${index}.png`),
          await enc.encode('png')
        );
      }
      const mrz = await ocrText(mrzCanvas, { mrzMode: true, ocr });
      const vis = await ocrText(candidate.canvas, { mrzMode: false, ocr });
      console.log(`\n--- candidate ${candidate.id} ---`);
      console.log('MRZ OCR:', JSON.stringify(mrz.text));
      console.log('MRZ pair:', findTd3MrzLines(mrz.text));
      console.log('VISUAL OCR:\n', vis.text.slice(0, 800));
    }
  } finally {
    await ocr.terminate();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
