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

  const wide = bands.filter(
    (band) =>
      band.width >= width * MIN_WIDTH_RATIO &&
      band.width >= 180 &&
      band.height >= 6 &&
      aspect(band) >= MIN_LINE_ASPECT &&
      aspect(band) <= MAX_LINE_ASPECT
  );
  if (wide.length < 2) return [];

  const { gray, width: grayWidth } = toGrayImage(source);
  const threshold = otsuThreshold(gray);

  const candidates: MrzBandCandidate[] = [];

  for (let i = 0; i < wide.length - 1; i += 1) {
    const top = wide[i];
    const bottom = wide[i + 1];

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
        (measureSkew(gray, grayWidth, threshold, top) +
          measureSkew(gray, grayWidth, threshold, bottom)) /
        2,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
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
