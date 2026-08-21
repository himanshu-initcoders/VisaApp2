/**
 * Locate passport document(s) inside a scanned page.
 *
 * Handles three layouts:
 *   - one passport page per sheet (scanner PDF export)
 *   - front and back stacked vertically in a single image
 *   - front and back side by side in a single image
 */

import { createCanvas, cropCanvas, sourceSize, type Rect } from './imageOps';

type ImageSource = HTMLCanvasElement | HTMLImageElement;

const ANALYSIS_WIDTH = 720;

/** A passport data page is roughly 125 x 88 mm — about 1.42:1. */
const PAGE_ASPECT = 1.42;

interface Background {
  r: number;
  g: number;
  b: number;
  uniformity: number;
}

interface Run {
  start: number;
  end: number;
}

function median(values: number[]): number {
  if (!values.length) return 255;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function estimateBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Background {
  const border = Math.max(2, Math.round(Math.min(width, height) * 0.01));
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];

  const push = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    rs.push(data[i]);
    gs.push(data[i + 1]);
    bs.push(data[i + 2]);
  };

  for (let y = 0; y < height; y += 1) {
    for (let b = 0; b < border; b += 1) {
      push(b, y);
      push(width - 1 - b, y);
    }
  }
  for (let x = 0; x < width; x += 1) {
    for (let b = 0; b < border; b += 1) {
      push(x, b);
      push(x, height - 1 - b);
    }
  }

  const r = median(rs);
  const g = median(gs);
  const b = median(bs);

  let within = 0;
  for (let i = 0; i < rs.length; i += 1) {
    const distance =
      Math.abs(rs[i] - r) + Math.abs(gs[i] - g) + Math.abs(bs[i] - b);
    if (distance < 60) within += 1;
  }

  return { r, g, b, uniformity: rs.length ? within / rs.length : 0 };
}

function segmentRuns(counts: number[], minInk: number, mergeGap: number): Run[] {
  const runs: Run[] = [];
  let current: Run | null = null;

  for (let i = 0; i < counts.length; i += 1) {
    if (counts[i] >= minInk) {
      if (!current) current = { start: i, end: i };
      else current.end = i;
    } else if (current && i - current.end > mergeGap) {
      runs.push(current);
      current = null;
    }
  }
  if (current) runs.push(current);
  return runs;
}

function boundingBox(
  mask: Uint8Array,
  width: number,
  bounds: { left: number; right: number; top: number; bottom: number }
): Rect | null {
  let left = bounds.right;
  let right = bounds.left;
  let top = bounds.bottom;
  let bottom = bounds.top;

  for (let y = bounds.top; y <= bounds.bottom; y += 1) {
    for (let x = bounds.left; x <= bounds.right; x += 1) {
      if (mask[y * width + x]) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (left > right || top > bottom) return null;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * A block much taller or wider than one passport page usually holds both
 * pages with no white gutter. Cut it at the quietest line in the middle.
 */
function splitOversizedBlock(
  rect: Rect,
  mask: Uint8Array,
  width: number
): Rect[] {
  const aspect = rect.width / rect.height;

  if (aspect < PAGE_ASPECT * 0.62) {
    const from = Math.round(rect.y + rect.height * 0.34);
    const to = Math.round(rect.y + rect.height * 0.66);
    let bestY = -1;
    let bestInk = Infinity;
    for (let y = from; y <= to; y += 1) {
      let ink = 0;
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        if (mask[y * width + x]) ink += 1;
      }
      if (ink < bestInk) {
        bestInk = ink;
        bestY = y;
      }
    }
    if (bestY > 0 && bestInk < rect.width * 0.08) {
      return [
        { ...rect, height: bestY - rect.y },
        { ...rect, y: bestY, height: rect.y + rect.height - bestY },
      ];
    }
  }

  if (aspect > PAGE_ASPECT * 1.55) {
    const from = Math.round(rect.x + rect.width * 0.34);
    const to = Math.round(rect.x + rect.width * 0.66);
    let bestX = -1;
    let bestInk = Infinity;
    for (let x = from; x <= to; x += 1) {
      let ink = 0;
      for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        if (mask[y * width + x]) ink += 1;
      }
      if (ink < bestInk) {
        bestInk = ink;
        bestX = x;
      }
    }
    if (bestX > 0 && bestInk < rect.height * 0.08) {
      return [
        { ...rect, width: bestX - rect.x },
        { ...rect, x: bestX, width: rect.x + rect.width - bestX },
      ];
    }
  }

  return [rect];
}

/**
 * Find document blocks on a page, in reading order (top to bottom,
 * left to right). Returns page-space rects.
 * Falls back to the whole page when the background is not a uniform sheet
 * (e.g. a phone photo of a passport on a busy surface).
 */
export function findDocumentRegions(source: ImageSource): Rect[] {
  const { width: fullWidth, height: fullHeight } = sourceSize(source);
  const fullRect: Rect = { x: 0, y: 0, width: fullWidth, height: fullHeight };
  if (!fullWidth || !fullHeight) return [fullRect];

  const scale = Math.min(1, ANALYSIS_WIDTH / fullWidth);
  const aw = Math.max(1, Math.round(fullWidth * scale));
  const ah = Math.max(1, Math.round(fullHeight * scale));

  const analysis = createCanvas(aw, ah);
  const ctx = analysis.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [fullRect];
  ctx.drawImage(source, 0, 0, fullWidth, fullHeight, 0, 0, aw, ah);

  const { data } = ctx.getImageData(0, 0, aw, ah);
  const background = estimateBackground(data, aw, ah);
  if (background.uniformity < 0.75) return [fullRect];

  // Per-channel distance ignores the soft grey vignette scanners add around
  // a document while still catching print, photo and security patterns.
  const contentThreshold = 40;
  const rowCounts = new Array<number>(ah).fill(0);
  const mask = new Uint8Array(aw * ah);

  for (let y = 0; y < ah; y += 1) {
    let count = 0;
    for (let x = 0; x < aw; x += 1) {
      const i = (y * aw + x) * 4;
      const distance = Math.max(
        Math.abs(data[i] - background.r),
        Math.abs(data[i + 1] - background.g),
        Math.abs(data[i + 2] - background.b)
      );
      if (distance > contentThreshold) {
        mask[y * aw + x] = 1;
        count += 1;
      }
    }
    rowCounts[y] = count;
  }

  const rowRuns = segmentRuns(
    rowCounts,
    Math.max(3, aw * 0.02),
    Math.max(4, ah * 0.025)
  );

  const blocks: Rect[] = [];
  for (const run of rowRuns) {
    // Column projection inside the band splits documents placed side by side
    const colCounts = new Array<number>(aw).fill(0);
    for (let y = run.start; y <= run.end; y += 1) {
      for (let x = 0; x < aw; x += 1) {
        if (mask[y * aw + x]) colCounts[x] += 1;
      }
    }
    const runHeight = run.end - run.start + 1;
    const colRuns = segmentRuns(
      colCounts,
      Math.max(2, runHeight * 0.02),
      Math.max(4, aw * 0.035)
    );
    const columns = colRuns.length ? colRuns : [{ start: 0, end: aw - 1 }];

    for (const column of columns) {
      const box = boundingBox(mask, aw, {
        left: column.start,
        right: column.end,
        top: run.start,
        bottom: run.end,
      });
      if (box) blocks.push(...splitOversizedBlock(box, mask, aw));
    }
  }

  const padX = Math.round(aw * 0.012);
  const padY = Math.round(ah * 0.012);
  const regions: Rect[] = [];

  for (const block of blocks) {
    const x = Math.max(0, block.x - padX);
    const y = Math.max(0, block.y - padY);
    const w = Math.min(aw - x, block.width + padX * 2);
    const h = Math.min(ah - y, block.height + padY * 2);

    const areaRatio = (w * h) / (aw * ah);
    if (areaRatio < 0.03) continue;
    if (w < aw * 0.15 || h < ah * 0.06) continue;

    regions.push({
      x: x / scale,
      y: y / scale,
      width: w / scale,
      height: h / scale,
    });
  }

  if (!regions.length) return [fullRect];

  // Drop slivers next to a dominant block (scanner artefacts, captions)
  const largestArea = regions.reduce(
    (max, r) => Math.max(max, r.width * r.height),
    0
  );
  const kept = regions.filter(
    (r) => (r.width * r.height) / largestArea >= 0.22
  );

  return (kept.length ? kept : regions).sort(
    (a, b) => a.y - b.y || a.x - b.x
  );
}

/**
 * Crop each detected document to a normalized, OCR-friendly canvas.
 * Small regions are upscaled so the MRZ has enough pixels per character.
 */
export function normalizeDocumentPages(
  source: ImageSource,
  options?: { targetWidth?: number; maxRegions?: number }
): HTMLCanvasElement[] {
  const targetWidth = options?.targetWidth ?? 1800;
  const maxRegions = options?.maxRegions ?? 3;
  const regions = findDocumentRegions(source).slice(0, maxRegions);

  return regions.map((rect) =>
    cropCanvas(source, rect, Math.min(2600, Math.max(targetWidth, rect.width)))
  );
}
