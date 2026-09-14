/**
 * Copy the pdf.js runtime assets into public/pdfjs so passport scanning never
 * depends on a third-party CDN.
 *
 * Without wasm/ pdf.js cannot decode JBIG2 or JPEG2000 scans — the page
 * renders blank and OCR silently reads nothing. Without the worker, PDF
 * upload fails outright under a strict CSP or offline.
 *
 * Runs from `postinstall` and `prebuild` so the copies can never drift from
 * the installed pdfjs-dist version.
 */
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

function packageDir(packageName) {
  return path.dirname(require.resolve(`${packageName}/package.json`));
}

async function packageVersion(packageName) {
  const manifest = await readFile(
    path.join(packageDir(packageName), 'package.json'),
    'utf8'
  );
  return JSON.parse(manifest).version;
}

// --- pdf.js -----------------------------------------------------------------
const pdfjsSource = packageDir('pdfjs-dist');
const pdfjsTarget = path.resolve(process.cwd(), 'public/pdfjs');

await mkdir(pdfjsTarget, { recursive: true });
// The legacy worker, to match the legacy main build the pipeline imports —
// mixing the two fails a version/API check at runtime.
await cp(
  path.join(pdfjsSource, 'legacy/build/pdf.worker.min.mjs'),
  path.join(pdfjsTarget, 'pdf.worker.min.mjs')
);
for (const dir of ['wasm', 'standard_fonts', 'cmaps']) {
  await cp(path.join(pdfjsSource, dir), path.join(pdfjsTarget, dir), {
    recursive: true,
  });
}

// --- tesseract.js -----------------------------------------------------------
// The defaults pull the worker script and wasm core from a public CDN on every
// scan. Serving them ourselves keeps passport images and their dependencies on
// our own origin, and keeps the flow working under a strict CSP.
const tesseractSource = packageDir('tesseract.js');
const tesseractCoreSource = packageDir('tesseract.js-core');
const tesseractTarget = path.resolve(process.cwd(), 'public/tesseract');

await mkdir(tesseractTarget, { recursive: true });
await cp(
  path.join(tesseractSource, 'dist/worker.min.js'),
  path.join(tesseractTarget, 'worker.min.js')
);
for (const file of [
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-lstm.wasm.js',
]) {
  await cp(
    path.join(tesseractCoreSource, file),
    path.join(tesseractTarget, file)
  );
}

const versions = {
  'pdfjs-dist': await packageVersion('pdfjs-dist'),
  'tesseract.js': await packageVersion('tesseract.js'),
  'tesseract.js-core': await packageVersion('tesseract.js-core'),
};

await writeFile(
  path.join(pdfjsTarget, 'version.json'),
  `${JSON.stringify(versions, null, 2)}\n`
);

console.log(
  `Synced public/pdfjs and public/tesseract (${Object.entries(versions)
    .map(([name, value]) => `${name} ${value}`)
    .join(', ')})`
);
