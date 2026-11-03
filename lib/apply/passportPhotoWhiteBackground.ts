/**
 * Client-side white background for passport photos.
 * Uses MediaPipe Selfie Segmenter already in the dependency tree.
 */

const MEDIAPIPE_VERSION = '0.10.35';
const MEDIAPIPE_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const SELFIE_SEGMENTER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite';

/** Soft edge for white-background composite (person confidence). */
const PERSON_ALPHA_LOW = 0.2;
const PERSON_ALPHA_HIGH = 0.82;

const MEDIAPIPE_NOISE =
  /TensorFlow Lite XNNPACK delegate|XNNPACK delegate for CPU/i;

type VisionFileset = Awaited<
  ReturnType<
    typeof import('@mediapipe/tasks-vision').FilesetResolver.forVisionTasks
  >
>;

type VisionModule = typeof import('@mediapipe/tasks-vision');

interface MaskLike {
  width: number;
  height: number;
  getAsUint8Array: () => Uint8Array;
  getAsFloat32Array: () => Float32Array;
}

interface ImageSegmenterResultLike {
  categoryMask?: MaskLike;
  confidenceMasks?: MaskLike[];
  close: () => void;
}

interface ImageSegmenterLike {
  segment: (
    image: HTMLCanvasElement,
    callback: (result: ImageSegmenterResultLike) => void
  ) => void;
  close: () => void;
}

let segmenterPromise: Promise<ImageSegmenterLike> | null = null;
let silenceDepth = 0;
let silencedConsole: {
  error: typeof console.error;
  warn: typeof console.warn;
  info: typeof console.info;
  log: typeof console.log;
} | null = null;

function isMediapipeNoise(args: unknown[]) {
  return args.some((arg) => {
    if (typeof arg === 'string') return MEDIAPIPE_NOISE.test(arg);
    if (arg instanceof Error) return MEDIAPIPE_NOISE.test(arg.message);
    return false;
  });
}

function beginMediapipeSilence() {
  if (silenceDepth === 0) {
    silencedConsole = {
      error: console.error,
      warn: console.warn,
      info: console.info,
      log: console.log,
    };
    const wrap =
      (original: (...args: unknown[]) => void) =>
      (...args: unknown[]) => {
        if (isMediapipeNoise(args)) return;
        original.apply(console, args);
      };
    console.error = wrap(silencedConsole.error);
    console.warn = wrap(silencedConsole.warn);
    console.info = wrap(silencedConsole.info);
    console.log = wrap(silencedConsole.log);
  }
  silenceDepth += 1;
}

function endMediapipeSilence() {
  if (silenceDepth === 0) return;
  silenceDepth -= 1;
  if (silenceDepth === 0 && silencedConsole) {
    console.error = silencedConsole.error;
    console.warn = silencedConsole.warn;
    console.info = silencedConsole.info;
    console.log = silencedConsole.log;
    silencedConsole = null;
  }
}

function featherPersonAlpha(value: number) {
  if (value <= PERSON_ALPHA_LOW) return 0;
  if (value >= PERSON_ALPHA_HIGH) return 1;
  return (value - PERSON_ALPHA_LOW) / (PERSON_ALPHA_HIGH - PERSON_ALPHA_LOW);
}

async function createSelfieSegmenter(): Promise<ImageSegmenterLike> {
  beginMediapipeSilence();
  try {
    const vision = (await import(
      '@mediapipe/tasks-vision'
    )) as VisionModule;
    const fileset = (await vision.FilesetResolver.forVisionTasks(
      MEDIAPIPE_WASM
    )) as VisionFileset;

    const shared = {
      runningMode: 'IMAGE' as const,
      outputCategoryMask: true,
      outputConfidenceMasks: true,
    };

    // CPU first: mask bytes are read on the main thread for the white composite.
    try {
      return (await vision.ImageSegmenter.createFromOptions(fileset, {
        ...shared,
        baseOptions: {
          modelAssetPath: SELFIE_SEGMENTER_MODEL,
          delegate: 'CPU',
        },
      })) as ImageSegmenterLike;
    } catch {
      return (await vision.ImageSegmenter.createFromOptions(fileset, {
        ...shared,
        baseOptions: {
          modelAssetPath: SELFIE_SEGMENTER_MODEL,
          delegate: 'GPU',
        },
      })) as ImageSegmenterLike;
    }
  } finally {
    endMediapipeSilence();
  }
}

function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = createSelfieSegmenter().catch((error) => {
      segmenterPromise = null;
      throw error;
    });
  }
  return segmenterPromise;
}

function runSegmenter(
  segmenter: ImageSegmenterLike,
  source: HTMLCanvasElement
): {
  category?: { width: number; height: number; data: Uint8Array };
  confidence?: { width: number; height: number; data: Float32Array };
} {
  // Copy mask bytes inside the callback — GPU-backed masks are only valid then.
  let category: { width: number; height: number; data: Uint8Array } | undefined;
  let confidence:
    | { width: number; height: number; data: Float32Array }
    | undefined;

  segmenter.segment(source, (result) => {
    try {
      if (result.categoryMask) {
        category = {
          width: result.categoryMask.width,
          height: result.categoryMask.height,
          data: new Uint8Array(result.categoryMask.getAsUint8Array()),
        };
      }
      const masks = result.confidenceMasks;
      if (masks && masks.length > 0) {
        const personMask = masks.length > 1 ? masks[1] : masks[0];
        confidence = {
          width: personMask.width,
          height: personMask.height,
          data: Float32Array.from(personMask.getAsFloat32Array()),
        };
      }
    } finally {
      result.close();
    }
  });

  return { category, confidence };
}

/**
 * Replace non-person pixels with white. Samples near image center to learn
 * which mask value is the person (passport photos are face-centered).
 */
function replaceBackgroundWithWhite(source: HTMLCanvasElement) {
  return getSegmenter().then((segmenter) => {
    const context = source.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Could not read the photo for background removal.');
    }

    const { category, confidence } = runSegmenter(segmenter, source);
    if (!category && !confidence) {
      throw new Error('Background removal did not return a face mask.');
    }

    const image = context.getImageData(0, 0, source.width, source.height);
    const pixels = image.data;
    const sampleXRatio = 0.5;
    const sampleYRatio = 0.42;
    let changed = 0;

    if (confidence) {
      const { width: mw, height: mh, data: mask } = confidence;
      const sampleX = Math.min(
        mw - 1,
        Math.max(0, Math.floor(sampleXRatio * mw))
      );
      const sampleY = Math.min(
        mh - 1,
        Math.max(0, Math.floor(sampleYRatio * mh))
      );
      const centerValue = mask[sampleY * mw + sampleX] ?? 0;
      const invert = centerValue < 0.5;

      for (let y = 0; y < source.height; y++) {
        const my = Math.min(mh - 1, Math.floor((y / source.height) * mh));
        for (let x = 0; x < source.width; x++) {
          const mx = Math.min(mw - 1, Math.floor((x / source.width) * mw));
          let person = mask[my * mw + mx] ?? 0;
          if (invert) person = 1 - person;
          const alpha = featherPersonAlpha(person);
          if (alpha >= 0.999) continue;
          const i = (y * source.width + x) * 4;
          const inv = 1 - alpha;
          pixels[i] = Math.round(pixels[i] * alpha + 255 * inv);
          pixels[i + 1] = Math.round(pixels[i + 1] * alpha + 255 * inv);
          pixels[i + 2] = Math.round(pixels[i + 2] * alpha + 255 * inv);
          if (alpha < 0.5) changed += 1;
        }
      }
    } else if (category) {
      const { width: mw, height: mh, data: mask } = category;
      const sampleX = Math.min(
        mw - 1,
        Math.max(0, Math.floor(sampleXRatio * mw))
      );
      const sampleY = Math.min(
        mh - 1,
        Math.max(0, Math.floor(sampleYRatio * mh))
      );
      const personCategory = mask[sampleY * mw + sampleX] ?? 1;

      for (let y = 0; y < source.height; y++) {
        const my = Math.min(mh - 1, Math.floor((y / source.height) * mh));
        for (let x = 0; x < source.width; x++) {
          const mx = Math.min(mw - 1, Math.floor((x / source.width) * mw));
          if ((mask[my * mw + mx] ?? 0) === personCategory) continue;
          const i = (y * source.width + x) * 4;
          pixels[i] = 255;
          pixels[i + 1] = 255;
          pixels[i + 2] = 255;
          changed += 1;
        }
      }
    }

    if (changed < Math.max(64, source.width * source.height * 0.02)) {
      throw new Error('Background removal could not separate the person.');
    }

    context.putImageData(image, 0, 0);
    return source;
  });
}

async function loadImageToCanvas(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error('Could not download the original photo.');
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not read the photo.'));
      img.src = objectUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    if (canvas.width < 2 || canvas.height < 2) {
      throw new Error('Photo is too small to process.');
    }
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Could not prepare the photo for background removal.');
    }
    context.drawImage(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not save the white-background photo.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.92
    );
  });
}

export function whiteBackgroundFilename(filename: string) {
  const base = filename.trim() || 'passport-photo';
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  return `${stem}-white-bg.jpg`;
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export function triggerUrlDownload(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'document';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Segment person and download a JPEG with a solid white background. */
export async function downloadPassportPhotoWithWhiteBackground(options: {
  imageUrl: string;
  filename: string;
}) {
  const canvas = await loadImageToCanvas(options.imageUrl);
  await replaceBackgroundWithWhite(canvas);
  const blob = await canvasToJpegBlob(canvas);
  triggerBlobDownload(blob, whiteBackgroundFilename(options.filename));
}
