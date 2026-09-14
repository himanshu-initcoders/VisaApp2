/**
 * Rasterize every page of every sample into scripts/passport-samples/out/
 * so layout variety can be reviewed and ground truth written by hand.
 *
 * Run: npx tsx scripts/passport-samples/render.ts
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';

const SAMPLES_DIR = path.resolve(process.cwd(), 'Passports');
const OUT_DIR = path.resolve(process.cwd(), 'scripts/passport-samples/out');

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const files = (await readdir(SAMPLES_DIR)).filter((name) => /\.pdf$/i.test(name));

  for (const name of files) {
    const bytes = new Uint8Array(await readFile(path.join(SAMPLES_DIR, name)));
    const doc = await pdfjs.getDocument({
      data: bytes,
      disableFontFace: true,
    }).promise;

    const slug = name.replace(/\.pdf$/i, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(3, 1600 / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height)
      );
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        // @ts-expect-error napi-rs canvas context is API-compatible for pdfjs
        canvasContext: ctx,
        viewport,
      }).promise;

      const out = path.join(OUT_DIR, `${slug}-p${pageNumber}.png`);
      await writeFile(out, await canvas.encode('png'));
      console.log(`${out}  ${canvas.width}x${canvas.height}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
