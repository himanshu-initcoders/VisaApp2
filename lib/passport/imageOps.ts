/**
 * Low-level canvas helpers for passport detection:
 * cropping, grayscale, Otsu binarization and text-line band detection.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type ImageSource = HTMLCanvasElement | HTMLImageElement;

export function sourceSize(source: ImageSource): {
  width: number;
  height: number;
} {
  const width =
    'naturalWidth' in source && source.naturalWidth
      ? source.naturalWidth
      : source.width;
  const height =
    'naturalHeight' in source && source.naturalHeight
      ? source.naturalHeight
      : source.height;
  return { width, height };
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  return ctx;
}

/** Crop a region and optionally resample it to a target width. */
export function cropCanvas(
  source: ImageSource,
  rect: Rect,
  targetWidth?: number
): HTMLCanvasElement {
  const { width: sw, height: sh } = sourceSize(source);
  const x = Math.max(0, Math.min(sw - 1, Math.round(rect.x)));
  const y = Math.max(0, Math.min(sh - 1, Math.round(rect.y)));
  const w = Math.max(1, Math.min(sw - x, Math.round(rect.width)));
  const h = Math.max(1, Math.min(sh - y, Math.round(rect.height)));

  const scale = targetWidth ? targetWidth / w : 1;
  const canvas = createCanvas(w * scale, h * scale);
  const ctx = context2d(canvas);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, x, y, w, h, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function toCanvas(source: ImageSource): HTMLCanvasElement {
  if (source instanceof HTMLCanvasElement) return source;
  const { width, height } = sourceSize(source);
  const canvas = createCanvas(width, height);
  context2d(canvas).drawImage(source, 0, 0);
  return canvas;
}

export interface GrayImage {
  gray: Uint8ClampedArray;
  width: number;
  height: number;
}

export function toGrayImage(source: ImageSource): GrayImage {
  const canvas = toCanvas(source);
  const { width, height } = canvas;
  const { data } = context2d(canvas).getImageData(0, 0, width, height);
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return { gray, width, height };
}

/** Otsu's method — automatic ink/paper threshold. */
export function otsuThreshold(gray: Uint8ClampedArray): number {
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i += 1) histogram[gray[i]] += 1;

  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t += 1) sum += t * histogram[t];

  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t += 1) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const between =
      weightBackground *
      weightForeground *
      (meanBackground - meanForeground) ** 2;

    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/** High-contrast black/white copy — what OCR reads best for MRZ. */
export function binarizeCanvas(
  source: ImageSource,
  options?: { bias?: number; invert?: boolean }
): HTMLCanvasElement {
  const canvas = toCanvas(source);
  const { width, height } = canvas;
  const ctx = context2d(canvas);
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  const threshold = otsuThreshold(gray) + (options?.bias ?? 0);
  const out = createCanvas(width, height);
  const outCtx = context2d(out);
  const outData = outCtx.createImageData(width, height);

  for (let p = 0; p < gray.length; p += 1) {
    const isInk = gray[p] < threshold;
    const value = options?.invert ? (isInk ? 255 : 0) : isInk ? 0 : 255;
    const i = p * 4;
    outData.data[i] = value;
    outData.data[i + 1] = value;
    outData.data[i + 2] = value;
    outData.data[i + 3] = 255;
  }
  outCtx.putImageData(outData, 0, 0);
  return out;
}

/**
 * Detect horizontal text lines via ink projection.
 * Used to isolate the two MRZ rows so each can be OCR'd as a single line.
 */
export function findTextLineBands(
  source: ImageSource,
  options?: {
    minInkRatio?: number;
    minHeightPx?: number;
    mergeGapPx?: number;
  }
): Rect[] {
  const { gray, width, height } = toGrayImage(source);
  const threshold = otsuThreshold(gray);
  const minInkRatio = options?.minInkRatio ?? 0.02;
  const minHeightPx = options?.minHeightPx ?? Math.max(4, height * 0.02);
  const mergeGapPx = options?.mergeGapPx ?? Math.max(2, height * 0.012);

  const rowInk = new Array<number>(height).fill(0);
  for (let y = 0; y < height; y += 1) {
    let count = 0;
    const rowStart = y * width;
    for (let x = 0; x < width; x += 1) {
      if (gray[rowStart + x] < threshold) count += 1;
    }
    rowInk[y] = count;
  }

  const minInk = Math.max(3, width * minInkRatio);
  const runs: Array<{ start: number; end: number }> = [];
  let current: { start: number; end: number } | null = null;

  for (let y = 0; y < height; y += 1) {
    if (rowInk[y] >= minInk) {
      if (!current) current = { start: y, end: y };
      else current.end = y;
    } else if (current && y - current.end > mergeGapPx) {
      runs.push(current);
      current = null;
    }
  }
  if (current) runs.push(current);

  return runs
    .filter((run) => run.end - run.start + 1 >= minHeightPx)
    .map((run) => {
      let left = width;
      let right = 0;
      for (let y = run.start; y <= run.end; y += 1) {
        const rowStart = y * width;
        for (let x = 0; x < width; x += 1) {
          if (gray[rowStart + x] < threshold) {
            if (x < left) left = x;
            if (x > right) right = x;
          }
        }
      }
      if (left > right) {
        left = 0;
        right = width - 1;
      }
      return {
        x: left,
        y: run.start,
        width: right - left + 1,
        height: run.end - run.start + 1,
      };
    });
}

export function padRect(
  rect: Rect,
  padX: number,
  padY: number,
  bounds: { width: number; height: number }
): Rect {
  const x = Math.max(0, rect.x - padX);
  const y = Math.max(0, rect.y - padY);
  return {
    x,
    y,
    width: Math.min(bounds.width - x, rect.width + padX * 2),
    height: Math.min(bounds.height - y, rect.height + padY * 2),
  };
}
