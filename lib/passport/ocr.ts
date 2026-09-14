/**
 * Tesseract worker management for passport reading.
 *
 * Two things matter here.
 *
 * First, the model. The MRZ is set in OCR-B, and generic English traineddata
 * is very bad at it — Tesseract's own evaluation of synthetic MRZ lines gives
 * `eng` a 44.9% character error rate against 0% for a model trained on OCR-B.
 * Reading the MRZ with `eng` means fighting errors downstream with check
 * digits and confusion tables that should never have been needed. So the MRZ
 * is read with `ocrb` and only the printed zone with `eng`.
 *
 * Second, where the assets come from. Tesseract.js defaults to fetching its
 * worker script, wasm core and language data from a public CDN on every scan.
 * Everything is served from our own origin instead, so a passport scan never
 * depends on a third party being up or on a permissive CSP.
 */

import Tesseract from 'tesseract.js';
import { passportRuntime } from './runtime';

/** Full MRZ repertoire (ICAO 9303): A-Z, 0-9 and the filler. */
export const MRZ_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';

export type OcrLanguage = 'ocrb' | 'eng';

export interface OcrResult {
  text: string;
  confidence: number;
}

/**
 * Outside the browser, tesseract.js only accepts bytes, a file path or a URL.
 * A canvas handed straight through is read as raw memory and rejected as a
 * truncated file, so encode it first.
 */
function toRecognizable(image: Tesseract.ImageLike): Tesseract.ImageLike {
  if (typeof window !== 'undefined') return image;

  const candidate = image as { toBuffer?: (mime: string) => Uint8Array };
  if (typeof candidate?.toBuffer === 'function') {
    return candidate.toBuffer('image/png');
  }
  return image;
}

/**
 * A worker with both models loaded, switched per pass. Loading once and
 * reinitializing is much cheaper than standing up a second wasm instance.
 */
export interface PassportOcr {
  recognize(
    image: Tesseract.ImageLike,
    options: {
      language: OcrLanguage;
      psm?: (typeof Tesseract.PSM)[keyof typeof Tesseract.PSM];
    }
  ): Promise<OcrResult>;
  terminate(): Promise<void>;
}

export async function createPassportOcr(): Promise<PassportOcr> {
  const { tessdataPath, tesseractWorkerPath } = passportRuntime();

  const worker = await Tesseract.createWorker(['ocrb', 'eng'], 1, {
    langPath: tessdataPath,
    ...(tesseractWorkerPath ? { workerPath: tesseractWorkerPath } : {}),
    // Uncompressed traineddata, as synced into public/tessdata
    gzip: false,
    logger: () => undefined,
    errorHandler: () => undefined,
  });

  let active: OcrLanguage | null = null;

  return {
    async recognize(image, { language, psm }) {
      if (active !== language) {
        await worker.reinitialize(language, 1);
        active = language;
      }

      await worker.setParameters(
        language === 'ocrb'
          ? {
              tessedit_char_whitelist: MRZ_WHITELIST,
              tessedit_pageseg_mode: psm ?? Tesseract.PSM.SINGLE_BLOCK,
              preserve_interword_spaces: '0',
            }
          : {
              tessedit_char_whitelist: '',
              tessedit_pageseg_mode: psm ?? Tesseract.PSM.AUTO,
              preserve_interword_spaces: '1',
            }
      );

      const { data } = await worker.recognize(toRecognizable(image));
      return { text: data.text || '', confidence: data.confidence ?? 0 };
    },

    async terminate() {
      await worker.terminate();
    },
  };
}
