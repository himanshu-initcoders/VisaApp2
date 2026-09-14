/**
 * Run the real extraction pipeline over the sample corpus and score it against
 * the hand-transcribed ground truth.
 *
 * Run: npx tsx scripts/passport-samples/accuracy.ts [nameFilter]
 *
 * A wrong field is worse than a blank one here, because the form pre-fills
 * from these values, so misses and mismatches are reported separately.
 */
import './nodeCanvas';

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { configurePassportRuntime } from '../../lib/passport/runtime';
import { GROUND_TRUTH, SCORED_FIELDS, type SampleExpectation } from './groundTruth';

const SAMPLES_DIR = path.resolve(process.cwd(), 'Passports');

configurePassportRuntime({
  // pdf.js accepts a file:// base for its worker and wasm assets
  pdfjsAssets: `${new URL('file://')}${path
    .resolve(process.cwd(), 'public/pdfjs')
    .replace(/\\/g, '/')}/`,
  tessdataPath: path.resolve(process.cwd(), 'public/tessdata'),
  // Let tesseract.js use its own Node worker rather than the browser build
  tesseractWorkerPath: undefined,
});

function normalize(value: unknown): string {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .trim();
}

interface FieldOutcome {
  field: string;
  expected: string;
  actual: string;
  status: 'match' | 'mismatch' | 'missing';
}

function scoreSample(
  expectation: SampleExpectation,
  actual: Record<string, unknown>
): FieldOutcome[] {
  const outcomes: FieldOutcome[] = [];

  for (const field of SCORED_FIELDS) {
    const expected = expectation[field];
    if (!expected) continue;

    const got = actual[field];
    const status = !got
      ? 'missing'
      : normalize(got) === normalize(expected)
        ? 'match'
        : 'mismatch';

    outcomes.push({
      field,
      expected: String(expected),
      actual: String(got ?? ''),
      status,
    });
  }

  return outcomes;
}

async function main() {
  const filter = process.argv[2]?.toLowerCase();
  const available = new Set(await readdir(SAMPLES_DIR));

  // Imported after the runtime is configured so module-level defaults do not win
  const { extractIndianPassport, IndianPassportError } = await import(
    '../../lib/passport/extractIndianPassport'
  );

  let match = 0;
  let mismatch = 0;
  let missing = 0;
  const failures: string[] = [];

  for (const expectation of GROUND_TRUTH) {
    if (filter && !expectation.file.toLowerCase().includes(filter)) continue;
    if (!available.has(expectation.file)) {
      console.log(`\n=== ${expectation.file} === SKIPPED (file not found)`);
      continue;
    }

    const bytes = await readFile(path.join(SAMPLES_DIR, expectation.file));
    const blob = new Blob([bytes], {
      type: /\.pdf$/i.test(expectation.file)
        ? 'application/pdf'
        : /\.png$/i.test(expectation.file)
          ? 'image/png'
          : 'image/jpeg',
    });

    const started = Date.now();
    console.log(`\n=== ${expectation.file}`);
    console.log(`    ${expectation.layout}`);

    try {
      const result = await extractIndianPassport(blob);
      const elapsed = Date.now() - started;
      const outcomes = scoreSample(
        expectation,
        result as unknown as Record<string, unknown>
      );

      if (!outcomes.length) {
        console.log(
          `    no ground truth yet — read: ${result.passportNumber} / ` +
            `${result.surname} ${result.givenNames} / dob ${result.dateOfBirth} / ` +
            `exp ${result.dateOfExpiry}  (${elapsed}ms)`
        );
      }

      for (const outcome of outcomes) {
        if (outcome.status === 'match') {
          match += 1;
          continue;
        }
        if (outcome.status === 'mismatch') {
          mismatch += 1;
          failures.push(
            `${expectation.file} ${outcome.field}: expected ${outcome.expected}, got ${outcome.actual}`
          );
        } else {
          missing += 1;
          failures.push(
            `${expectation.file} ${outcome.field}: expected ${outcome.expected}, got nothing`
          );
        }
        console.log(
          `    ${outcome.status.toUpperCase().padEnd(8)} ${outcome.field}: ` +
            `expected ${outcome.expected} | got ${outcome.actual || '(blank)'}`
        );
      }

      const matched = outcomes.filter((o) => o.status === 'match').length;
      if (outcomes.length) {
        console.log(
          `    ${matched}/${outcomes.length} fields correct  (${elapsed}ms)` +
            (result.warnings.length ? `  warnings: ${result.warnings.length}` : '')
        );
      }
      if (matched < outcomes.length && result.rawMrz[0]) {
        console.log(`    mrz1: ${result.rawMrz[0]}`);
        console.log(`    mrz2: ${result.rawMrz[1]}`);
      }

      // Parents must never be invented from the data page
      if (!expectation.fathersName && result.fathersName) {
        failures.push(
          `${expectation.file} fathersName invented: ${result.fathersName}`
        );
        console.log(`    INVENTED father: ${result.fathersName}`);
      }
      if (!expectation.mothersName && result.mothersName) {
        failures.push(
          `${expectation.file} mothersName invented: ${result.mothersName}`
        );
        console.log(`    INVENTED mother: ${result.mothersName}`);
      }
    } catch (error) {
      const message =
        error instanceof IndianPassportError
          ? error.message
          : (error as Error).message;
      console.log(`    THREW: ${message}`);
      if (!(error instanceof IndianPassportError) && process.env.PASSPORT_DEBUG) {
        console.log((error as Error).stack);
      }
      failures.push(`${expectation.file}: threw — ${message}`);
    }
  }

  const scored = match + mismatch + missing;
  console.log('\n---------------------------------------------');
  console.log(
    `Scored fields: ${scored}  match: ${match}  mismatch: ${mismatch}  missing: ${missing}`
  );
  if (scored) {
    console.log(`Accuracy: ${((match / scored) * 100).toFixed(1)}%`);
  }
  if (failures.length) {
    console.log(`\n${failures.length} problem(s):`);
    for (const failure of failures) console.log(`  - ${failure}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
