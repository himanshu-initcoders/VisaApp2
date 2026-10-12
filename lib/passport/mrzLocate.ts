/**
 * Locate the machine-readable zone by its shape rather than by assuming it
 * sits in the bottom of the crop.
 *
 * The bottom-band assumption breaks on everything users actually upload: a
 * booklet spread scanned as one sheet puts the MRZ around 70% height, a
 * notarised copy adds stamps and attestation text below it, and a rotated
 * page puts it down one side.
 *
 * A TD3 MRZ is unusually easy to recognise geometrically. Two lines of 44
 * OCR-B characters span nearly the full width of the data page, so each line
 * is roughly 30 times wider than it is tall, the two lines are near-identical
 * in width and alignment, and they sit one line-height apart. Almost nothing
 * else on a passport, a stamp or a notary block looks like that.
 */

import {
  findTextLineBands,
  otsuThreshold,
  padRect,
  sourceSize,
  toGrayImage,
  type Rect,
} from './imageOps';

type ImageSource = HTMLCanvasElement | HTMLImageElement;

/** One MRZ line: 44 chars at ~2.55mm pitch over ~3.1mm of glyph height. */
const MIN_LINE_ASPECT = 10;
const MAX_LINE_ASPECT = 90;

/** The band spans the data page nearly edge to edge. */
const MIN_WIDTH_RATIO = 0.38;

export interface MrzBandCandidate {
  /** Region covering both MRZ lines, in source pixels. */
  rect: Rect;
  /** The individual line rects, top to bottom. */
  lines: Rect[];
  /** Higher is more MRZ-like. Comparable across rotations of one image. */
  score: number;
  /** Skew of the band in degrees, clockwise-positive. */
  skew: number;
}

function aspect(rect: Rect): number {
  return rect.height > 0 ? rect.width / rect.height : 0;
}

function relativeDifference(a: number, b: number): number {
  const largest = Math.max(a, b);
  return largest > 0 ? Math.abs(a - b) / largest : 1;
}

/**
 * Angle of a text line, from the vertical drift of its ink centroid between
 * the left and right halves. Cheaper than a Hough transform and accurate
 * enough for the ±3° skew a flatbed or phone introduces.
 */
function measureSkew(
  gray: Uint8ClampedArray,
  width: number,
  threshold: number,
  rect: Rect
): number {
  const centroid = (fromX: number, toX: number): number | null => {
    let sum = 0;
    let count = 0;
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = fromX; x < toX; x += 1) {
        if (gray[y * width + x] < threshold) {
          sum += y;
          count += 1;
        }
      }
    }
    return count > 0 ? sum / count : null;
  };

  const third = Math.floor(rect.width / 3);
  if (third < 4) return 0;

  const left = centroid(rect.x, rect.x + third);
  const right = centroid(rect.x + rect.width - third, rect.x + rect.width);
  if (left === null || right === null) return 0;

  const run = rect.width - third;
  return (Math.atan2(right - left, run) * 180) / Math.PI;
}

/**
 * Lines of dark type that run across the page.
 *
 * The projection in `findTextLineBands` needs quiet rows between lines. A
 * phone photo has none: the guilloche, the photograph and a little desk all
 * sit under one global threshold, so the whole frame becomes a single band.
 * Counting how many horizontal slices of a row are actually dark keeps the
 * MRZ (ink across the page) and drops a photograph (ink in one clump).
 */
function distributedLineBands(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number
): Rect[] {
  const slices = 24;
  const sliceWidth = Math.floor(width / slices);
  if (sliceWidth < 2) return [];

  const dense = new Array<boolean>(height);
  const rowLit = new Uint8Array(height * slices);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    const litRow = y * slices;
    let lit = 0;
    for (let slice = 0; slice < slices; slice += 1) {
      const x0 = slice * sliceWidth;
      let ink = 0;
      for (let x = x0; x < x0 + sliceWidth; x += 1) {
        if (gray[row + x] < threshold) ink += 1;
      }
      if (ink > sliceWidth * 0.08) {
        rowLit[litRow + slice] = 1;
        lit += 1;
      }
    }
    dense[y] = lit / slices >= 0.45;
  }

  const minHeight = Math.max(4, Math.round(height * 0.008));
  const mergeGap = Math.max(1, Math.round(height * 0.004));
  const rects: Rect[] = [];
  let start = -1;
  let gap = 0;

  const close = (end: number) => {
    const y0 = start;
    start = -1;
    gap = 0;
    if (y0 < 0) return;
    const runHeight = end - y0 + 1;
    if (runHeight < minHeight) return;
    // A dark border along the frame edge is a shadow, not a line of type.
    if (y0 <= 1 || end >= height - 2) return;

    // The span is the longest run of slices that stay dark down the line.
    // A photograph in the same rows is a separate clump and must not pull
    // the rectangle out to the frame edge.
    const hits = new Array<number>(slices).fill(0);
    for (let y = y0; y <= end; y += 1) {
      const litRow = y * slices;
      for (let slice = 0; slice < slices; slice += 1) {
        hits[slice] += rowLit[litRow + slice];
      }
    }
    const on = hits.map((count) => count / runHeight >= 0.4);
    let bestStart = 0;
    let bestLength = 0;
    let runStart = -1;
    for (let slice = 0; slice <= slices; slice += 1) {
      if (slice < slices && on[slice]) {
        if (runStart < 0) runStart = slice;
      } else if (runStart >= 0) {
        const length = slice - runStart;
        if (length > bestLength) {
          bestStart = runStart;
          bestLength = length;
        }
        runStart = -1;
      }
    }
    if (bestLength < 2) return;

    const left = Math.max(0, (bestStart - 1) * sliceWidth);
    const right = Math.min(width - 1, (bestStart + bestLength + 1) * sliceWidth);
    rects.push({
      x: left,
      y: y0,
      width: right - left + 1,
      height: runHeight,
    });
  };

  for (let y = 0; y < height; y += 1) {
    if (dense[y]) {
      if (start < 0) start = y;
      gap = 0;
    } else if (start >= 0) {
      gap += 1;
      if (gap > mergeGap) close(y - gap);
    }
  }
  if (start >= 0) close(height - 1);

  return rects;
}

function pairMrzLines(
  lines: Rect[],
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number
): MrzBandCandidate[] {
  const candidates: MrzBandCandidate[] = [];

  for (let i = 0; i < lines.length - 1; i += 1) {
    const top = lines[i];
    const bottom = lines[i + 1];

    const gap = bottom.y - (top.y + top.height);
    const lineHeight = Math.max(top.height, bottom.height);
    // Consecutive MRZ lines are set solid: the gap never exceeds a line.
    if (gap < -lineHeight * 0.5 || gap > lineHeight * 2.2) continue;

    const widthDiff = relativeDifference(top.width, bottom.width);
    const heightDiff = relativeDifference(top.height, bottom.height);
    const leftDiff = Math.abs(top.x - bottom.x) / width;
    if (widthDiff > 0.28 || heightDiff > 0.5 || leftDiff > 0.12) continue;

    const x = Math.min(top.x, bottom.x);
    const right = Math.max(top.x + top.width, bottom.x + bottom.width);
    const rect: Rect = {
      x,
      y: top.y,
      width: right - x,
      height: bottom.y + bottom.height - top.y,
    };

    // Prefer wide, well-matched, well-aligned pairs. The lower on the page the
    // pair sits the more likely it is the MRZ rather than a printed table.
    const widthRatio = rect.width / width;
    const verticalPosition = (rect.y + rect.height / 2) / height;
    const score =
      widthRatio * 40 +
      (1 - widthDiff) * 25 +
      (1 - leftDiff) * 15 +
      verticalPosition * 10 +
      (aspect(top) >= 20 && aspect(top) <= 45 ? 10 : 0);

    candidates.push({
      rect,
      lines: [top, bottom],
      score,
      skew:
        (measureSkew(gray, width, threshold, top) +
          measureSkew(gray, width, threshold, bottom)) /
        2,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Rank candidate MRZ bands in an image, best first.
 *
 * Returns an empty array when nothing MRZ-shaped is present, which is itself
 * the signal used to skip visa pages and blank booklet pages.
 */
export function findMrzBands(source: ImageSource): MrzBandCandidate[] {
  const { width, height } = sourceSize(source);
  if (!width || !height) return [];

  const bands = findTextLineBands(source, {
    minInkRatio: 0.015,
    minHeightPx: Math.max(3, height * 0.006),
    mergeGapPx: Math.max(1, height * 0.004),
  });

  const wideEnough = (band: Rect) =>
    band.width >= width * MIN_WIDTH_RATIO &&
    band.width >= 180 &&
    band.height >= 6 &&
    aspect(band) >= MIN_LINE_ASPECT &&
    aspect(band) <= MAX_LINE_ASPECT;

  let wide = bands.filter(wideEnough);
  const { gray } = toGrayImage(source);
  const threshold = otsuThreshold(gray);
  let inkThreshold = threshold;

  // Only the desk-photo failure: every row counts as ink, so the projection
  // is one rectangle the size of the frame. Other misses (a skewed scan, a
  // blank page) stay misses — inventing a band there steers the read wrong.
  const collapsedFrame =
    bands.length === 1 &&
    bands[0].width >= width * 0.85 &&
    bands[0].height >= height * 0.85;

  if (wide.length < 2 && collapsedFrame) {
    // Darker than the page-wide split, so only glyph ink counts.
    inkThreshold = Math.max(40, Math.round(threshold * 0.62));
    wide = distributedLineBands(gray, width, height, inkThreshold).filter(wideEnough);
  }
  if (wide.length < 2) return [];

  return pairMrzLines(wide, gray, width, height, inkThreshold);
}

/**
 * How strongly this image looks like it holds a passport MRZ.
 * Used to pick the data page out of a multi-page upload before spending any
 * OCR time, and to choose between 90° rotations.
 */
export function mrzBandScore(source: ImageSource): number {
  const [best] = findMrzBands(source);
  return best?.score ?? 0;
}

/**
 * The MRZ band with a margin, ready to crop. Falls back to the bottom of the
 * image when no band was found, which keeps behaviour sane for a tightly
 * cropped data page whose MRZ touches the edge.
 */
export function mrzRegion(
  source: ImageSource,
  candidate?: MrzBandCandidate
): { rect: Rect; skew: number } {
  const { width, height } = sourceSize(source);
  const best = candidate ?? findMrzBands(source)[0];

  if (!best) {
    const cropHeight = Math.max(48, Math.floor(height * 0.28));
    return {
      rect: {
        x: 0,
        y: height - cropHeight,
        width,
        height: cropHeight,
      },
      skew: 0,
    };
  }

  if (best.rect.width < 180 || best.rect.height < 8) {
    const cropHeight = Math.max(48, Math.floor(height * 0.28));
    return {
      rect: {
        x: 0,
        y: height - cropHeight,
        width,
        height: cropHeight,
      },
      skew: 0,
    };
  }

  return {
    rect: padRect(
      best.rect,
      Math.round(width * 0.015),
      Math.round(best.rect.height * 0.25),
      { width, height }
    ),
    skew: best.skew,
  };
}
