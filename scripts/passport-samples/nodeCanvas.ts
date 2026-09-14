/**
 * Minimal DOM surface so the browser passport pipeline runs unchanged in Node.
 *
 * This exists to make the sample corpus testable. Guessing whether a change
 * helps is not good enough for a flow that pre-fills someone's visa
 * application, and the only honest way to measure is to run the real pipeline
 * over the real files.
 *
 * Import this before anything from lib/passport.
 */
// Must be loaded before `document` is shimmed below. tesseract.js decides
// whether it is running in a browser by checking for a global `document` once,
// at module load, and then resolves its worker paths against
// `window.location`. Importing it first pins it to its Node code path.
import 'tesseract.js';

import {
  Canvas,
  DOMMatrix,
  Image,
  ImageData,
  Path2D,
  createCanvas,
  loadImage,
} from '@napi-rs/canvas';

type ShimGlobal = {
  document?: {
    createElement(tag: string): unknown;
    createElementNS(ns: string, tag: string): unknown;
    fonts: { add: (font: unknown) => unknown };
  };
  HTMLCanvasElement?: unknown;
  HTMLImageElement?: unknown;
  Image?: unknown;
  ImageData?: unknown;
  Path2D?: unknown;
  DOMMatrix?: unknown;
  createImageBitmap?: unknown;
};
const scope = globalThis as unknown as ShimGlobal;

if (!scope.document) {
  // napi-rs Canvas is not an HTMLElement; this only has to satisfy pdf.js at runtime.
  scope.document = {
    createElement(tag: string) {
      if (tag !== 'canvas') {
        throw new Error(`nodeCanvas shim cannot create <${tag}>`);
      }
      return createCanvas(1, 1);
    },
    createElementNS(_ns: string, tag: string) {
      return scope.document!.createElement(tag);
    },
    fonts: { add: () => undefined },
  };
}

scope.HTMLCanvasElement ??= Canvas;
scope.HTMLImageElement ??= Image;
scope.Image ??= Image;
scope.ImageData ??= ImageData;
scope.Path2D ??= Path2D;
scope.DOMMatrix ??= DOMMatrix;

// napi-rs exposes encode()/toBuffer() rather than the DOM toBlob callback.
const canvasProto = Canvas.prototype as unknown as {
  toBlob?: (cb: (blob: Blob | null) => void, type?: string, quality?: number) => void;
  encode(format: string, quality?: number): Promise<Buffer>;
};
if (!canvasProto.toBlob) {
  canvasProto.toBlob = function toBlob(callback, type = 'image/png', quality) {
    const format = type === 'image/jpeg' ? 'jpeg' : 'png';
    this.encode(format, quality !== undefined ? Math.round(quality * 100) : undefined)
      .then((buffer) =>
        callback(new Blob([Uint8Array.from(buffer)], { type }))
      )
      .catch(() => callback(null));
  };
}

if (typeof scope.createImageBitmap !== 'function') {
  // Return the napi Image itself — drawImage accepts it, and a spread copy
  // would lose the native handle it draws from.
  scope.createImageBitmap = async (blob: Blob) => {
    const image = await loadImage(Buffer.from(await blob.arrayBuffer()));
    Object.assign(image, { close: () => undefined });
    return image;
  };
}

if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'node:preview';
  URL.revokeObjectURL = () => undefined;
}
