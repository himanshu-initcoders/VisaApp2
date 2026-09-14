/**
 * Dump ranked crops for one sample so page-selection bugs are visible.
 * Run: npx tsx scripts/passport-samples/debugCrops.ts "Dilip Passport.pdf"
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
  const { findMrzBands } = await import('../../lib/passport/mrzLocate');
  const { guessOrientation } = await import('../../lib/passport/orientation');

  const bytes = await readFile(path.join(process.cwd(), 'Passports', name));
  const blob = new Blob([bytes], {
    type: /\.pdf$/i.test(name) ? 'application/pdf' : 'image/jpeg',
  });

  const outDir = path.resolve(process.cwd(), 'scripts/passport-samples/debug');
  await mkdir(outDir, { recursive: true });

  const candidates = await selectCandidatePages(blob);
  console.log(`${name}: ${candidates.length} candidate(s)`);

  for (const [index, candidate] of candidates.entries()) {
    const canvas = candidate.canvas as unknown as {
      width: number;
      height: number;
      encode?: (fmt: string) => Promise<Buffer>;
    };
    const bands = findMrzBands(candidate.canvas);
    const guess = guessOrientation(candidate.canvas);
    console.log(
      `  [${index}] id=${candidate.id} page=${candidate.pageNumber}/${candidate.sourcePageCount} ` +
        `${canvas.width}x${canvas.height} rot=${candidate.rotation} ` +
        `bandScore=${candidate.bandScore.toFixed(1)} bands=${bands.length} ` +
        `guess=[${guess.rotations.join(',')}] guessBand=${guess.bandScore.toFixed(1)} ` +
        `textLayer=${candidate.textLayer.replace(/\s+/g, ' ').slice(0, 80)}`
    );
    if (typeof canvas.encode === 'function') {
      const file = path.join(outDir, `${index}-${candidate.id.replace(':', '-')}.png`);
      await writeFile(file, await canvas.encode('png'));
      console.log(`      wrote ${file}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
