/**
 * Where the passport pipeline finds its runtime assets.
 *
 * The same extraction code runs in three places: the browser during upload,
 * a Node route for the server-side retry, and the offline harness that scores
 * the sample corpus. Only the asset locations differ — URL paths in the
 * browser, filesystem paths in Node — so they live here rather than being
 * hardcoded at each use.
 */

export interface PassportRuntime {
  /** Base for pdf.js worker and wasm assets. Must end with a separator. */
  pdfjsAssets: string;
  /** Directory holding ocrb.traineddata and eng.traineddata. */
  tessdataPath: string;
  /**
   * Tesseract worker script. Leave undefined in Node so tesseract.js uses its
   * own Node worker instead of the browser build.
   */
  tesseractWorkerPath?: string;
}

const BROWSER_DEFAULTS: PassportRuntime = {
  pdfjsAssets: '/pdfjs/',
  tessdataPath: '/tessdata',
  tesseractWorkerPath: '/tesseract/worker.min.js',
};

let current: PassportRuntime = { ...BROWSER_DEFAULTS };

/** Point the pipeline at a different set of assets, e.g. on the server. */
export function configurePassportRuntime(
  overrides: Partial<PassportRuntime>
): void {
  current = { ...current, ...overrides };
}

export function passportRuntime(): PassportRuntime {
  return current;
}
