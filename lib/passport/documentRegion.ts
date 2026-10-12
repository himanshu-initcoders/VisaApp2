/**
 * Locate passport document(s) inside a scanned page.
 *
 * Handles three layouts:
 *   - one passport page per sheet (scanner PDF export)
 *   - front and back stacked vertically in a single image
 *   - front and back side by side in a single image
 */

import {
  createCanvas,
  cropCanvas,
  otsuThreshold,
  sourceSize,
  type Rect,
} from './imageOps';

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

/** Square-element dilation. Horizontal and vertical passes are equivalent. */
function dilateHorizontal(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let count = 0;
    const head = Math.min(width - 1, radius);
    for (let x = 0; x <= head; x += 1) count += mask[row + x];
    for (let x = 0; x < width; x += 1) {
      out[row + x] = count > 0 ? 1 : 0;
      const remove = x - radius;
      if (remove >= 0) count -= mask[row + remove];
      const add = x + radius + 1;
      if (add < width) count += mask[row + add];
    }
  }
  return out;
}

function dilateVertical(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let x = 0; x < width; x += 1) {
    let count = 0;
    const head = Math.min(height - 1, radius);
    for (let y = 0; y <= head; y += 1) count += mask[y * width + x];
    for (let y = 0; y < height; y += 1) {
      out[y * width + x] = count > 0 ? 1 : 0;
      const remove = y - radius;
      if (remove >= 0) count -= mask[remove * width + x];
      const add = y + radius + 1;
      if (add < height) count += mask[add * width + x];
    }
  }
  return out;
}

function erodeHorizontal(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    let count = 0;
    const head = Math.min(width - 1, radius);
    for (let x = 0; x <= head; x += 1) count += mask[row + x];
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width - 1, x + radius);
      out[row + x] = count === right - left + 1 ? 1 : 0;
      const remove = x - radius;
      if (remove >= 0) count -= mask[row + remove];
      const add = x + radius + 1;
      if (add < width) count += mask[row + add];
    }
  }
  return out;
}

function erodeVertical(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let x = 0; x < width; x += 1) {
    let count = 0;
    const head = Math.min(height - 1, radius);
    for (let y = 0; y <= head; y += 1) count += mask[y * width + x];
    for (let y = 0; y < height; y += 1) {
      const top = Math.max(0, y - radius);
      const bottom = Math.min(height - 1, y + radius);
      out[y * width + x] = count === bottom - top + 1 ? 1 : 0;
      const remove = y - radius;
      if (remove >= 0) count -= mask[remove * width + x];
      const add = y + radius + 1;
      if (add < height) count += mask[add * width + x];
    }
  }
  return out;
}

/** Bridge printed text so a page stays one piece, without filling a photograph. */
function closeBright(mask: Uint8Array, width: number, height: number): Uint8Array {
  const radius = Math.max(2, Math.round(Math.min(width, height) * 0.012));
  const dilated = dilateVertical(
    dilateHorizontal(mask, width, height, radius),
    width,
    height,
    radius
  );
  return erodeVertical(
    erodeHorizontal(dilated, width, height, radius),
    width,
    height,
    radius
  );
}

function connectedPageRects(
  mask: Uint8Array,
  width: number,
  height: number,
  minArea: number
): Array<{ area: number; rect: Rect }> {
  const seen = new Uint8Array(mask.length);
  const found: Array<{ area: number; rect: Rect }> = [];
  const stack: number[] = [];

  const visit = (index: number) => {
    if (mask[index] && !seen[index]) {
      seen[index] = 1;
      stack.push(index);
    }
  };

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;
    stack.push(start);
    seen[start] = 1;
    let area = 0;
    let left = width;
    let right = 0;
    let top = height;
    let bottom = 0;

    while (stack.length) {
      const index = stack.pop() as number;
      const x = index % width;
      const y = (index - x) / width;
      area += 1;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x > 0) visit(index - 1);
      if (x + 1 < width) visit(index + 1);
      if (y > 0) visit(index - width);
      if (y + 1 < height) visit(index + width);
    }

    if (area < minArea) continue;
    found.push({
      area,
      rect: {
        x: left,
        y: top,
        width: right - left + 1,
        height: bottom - top + 1,
      },
    });
  }

  return found.sort((a, b) => b.area - a.area);
}

/**
 * A booklet gutter is a narrow dark seam. A portrait or an MRZ is a wide dark
 * block, and cutting through either of those drops half the data page.
 */
function narrowValley(fractions: number[]): number | null {
  if (fractions.length < 24) return null;
  const sorted = [...fractions].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  if (mid < 0.28) return null;

  const from = Math.floor(fractions.length * 0.28);
  const to = Math.ceil(fractions.length * 0.72);
  const cut = mid * 0.5;
  let best = -1;
  let bestValue = Infinity;
  for (let i = from; i < to; i += 1) {
    if (fractions[i] < bestValue) {
      bestValue = fractions[i];
      best = i;
    }
  }
  if (best < 0 || bestValue > cut) return null;

  let left = best;
  let right = best;
  while (left > 0 && fractions[left - 1] <= cut) left -= 1;
  while (right + 1 < fractions.length && fractions[right + 1] <= cut) right += 1;

  const valley = right - left + 1;
  if (valley < Math.max(2, fractions.length * 0.008)) return null;
  if (valley > fractions.length * 0.08) return null;
  if (left < fractions.length * 0.22) return null;
  if (fractions.length - 1 - right < fractions.length * 0.22) return null;
  return Math.round((left + right) / 2);
}

function brightFractions(
  mask: Uint8Array,
  width: number,
  rect: Rect,
  axis: 'column' | 'row'
): number[] {
  if (axis === 'column') {
    const fractions = new Array<number>(rect.width).fill(0);
    for (let x = 0; x < rect.width; x += 1) {
      let count = 0;
      for (let y = 0; y < rect.height; y += 1) {
        if (mask[(rect.y + y) * width + rect.x + x]) count += 1;
      }
      fractions[x] = count / rect.height;
    }
    return fractions;
  }

  const fractions = new Array<number>(rect.height).fill(0);
  for (let y = 0; y < rect.height; y += 1) {
    let count = 0;
    const row = (rect.y + y) * width;
    for (let x = 0; x < rect.width; x += 1) {
      if (mask[row + rect.x + x]) count += 1;
    }
    fractions[y] = count / rect.width;
  }
  return fractions;
}

function splitOnGutter(rect: Rect, mask: Uint8Array, width: number): Rect[] {
  const columnCut = narrowValley(brightFractions(mask, width, rect, 'column'));
  const rowCut = narrowValley(brightFractions(mask, width, rect, 'row'));
  if (columnCut === null && rowCut === null) return [rect];

  const columnDepth =
    columnCut === null
      ? Infinity
      : brightFractions(mask, width, rect, 'column')[columnCut];
  const rowDepth =
    rowCut === null ? Infinity : brightFractions(mask, width, rect, 'row')[rowCut];

  if (columnCut !== null && columnDepth <= rowDepth) {
    return [
      { ...rect, width: columnCut },
      {
        ...rect,
        x: rect.x + columnCut,
        width: rect.width - columnCut,
      },
    ];
  }

  return [
    { ...rect, height: rowCut as number },
    {
      ...rect,
      y: rect.y + (rowCut as number),
      height: rect.height - (rowCut as number),
    },
  ];
}

function pageBrighterThanSurroundings(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  rect: Rect
): boolean {
  let inside = 0;
  let insideCount = 0;
  let outside = 0;
  let outsideCount = 0;
  const x1 = rect.x + rect.width;
  const y1 = rect.y + rect.height;

  for (let y = 0; y < height; y += 2) {
    const row = y * width;
    for (let x = 0; x < width; x += 2) {
      const value = gray[row + x];
      if (x >= rect.x && x < x1 && y >= rect.y && y < y1) {
        inside += value;
        insideCount += 1;
      } else {
        outside += value;
        outsideCount += 1;
      }
    }
  }

  if (!insideCount || !outsideCount) return false;
  return inside / insideCount > outside / outsideCount + 12;
}

function toSourceRect(
  rect: Rect,
  scale: number,
  fullWidth: number,
  fullHeight: number,
  frameWidth: number,
  frameHeight: number
): Rect {
  const padX = Math.round(rect.width * 0.045);
  const padY = Math.round(rect.height * 0.045);
  const x = Math.max(0, rect.x - padX);
  const y = Math.max(0, rect.y - padY);
  const w = Math.min(frameWidth - x, rect.width + padX * 2);
  const h = Math.min(frameHeight - y, rect.height + padY * 2);
  const sx = x / scale;
  const sy = y / scale;
  return {
    x: sx,
    y: sy,
    width: Math.min(w / scale, fullWidth - sx),
    height: Math.min(h / scale, fullHeight - sy),
  };
}

/**
 * Crop the pale passport page out of a desk photo.
 *
 * Printed text is closed over so a name line does not slice the page into
 * strips. An open booklet is split only on a narrow gutter. Anything that
 * still covers the whole frame is left alone — a tight crop that is not
 * actually tighter just risks clipping the MRZ.
 */
function findBrightPageRegions(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  scale: number,
  fullWidth: number,
  fullHeight: number
): Rect[] {
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  const threshold = otsuThreshold(gray);
  if (threshold < 40 || threshold > 220) return [];

  const bright = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i += 1) bright[i] = gray[i] >= threshold ? 1 : 0;

  const closed = closeBright(bright, width, height);
  const frameArea = width * height;
  const components = connectedPageRects(closed, width, height, frameArea * 0.06);
  if (!components.length) return [];

  const largest = components[0].area;
  const pieces: Rect[] = [];
  for (const component of components) {
    if (component.area < largest * 0.35) break;
    const cover = (component.rect.width * component.rect.height) / frameArea;
    if (cover > 0.96 || cover < 0.12) continue;
    if (!pageBrighterThanSurroundings(gray, width, height, component.rect)) continue;
    for (const part of splitOnGutter(component.rect, closed, width)) {
      const partCover = (part.width * part.height) / frameArea;
      if (partCover < 0.08) continue;
      pieces.push(
        toSourceRect(part, scale, fullWidth, fullHeight, width, height)
      );
    }
  }

  return pieces.sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Find document blocks on a page, in reading order (top to bottom,
 * left to right). Returns page-space rects.
 *
 * A scanner sheet has a flat border, so the page is whatever differs from
 * that border. A phone photo of a booklet on a desk does not: the border is
 * wood and a hand. There the page is the large pale region, and the MRZ
 * search runs on that crop instead of the whole frame.
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
  const borderLuma =
    0.299 * background.r + 0.587 * background.g + 0.114 * background.b;
  // A pale uneven border is still a scan (vignette, a stamp in the margin).
  // A dark border is a desk or a hand. Only then is the page the bright region.
  if (background.uniformity < 0.75 && borderLuma < 160) {
    const bright = findBrightPageRegions(
      data,
      aw,
      ah,
      scale,
      fullWidth,
      fullHeight
    );
    return bright.length ? bright : [fullRect];
  }
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

  const padX = Math.round(aw * 0.02);
  const padY = Math.round(ah * 0.02);
  const regions: Rect[] = [];

  for (const block of blocks) {
    // The MRZ sits in a thin strip under the printed zone. Tight bounding
    // boxes on A4 scans often crop it off, so we pad the bottom extra.
    const extraBottom = Math.round(block.height * 0.28);
    const x = Math.max(0, block.x - padX);
    const y = Math.max(0, block.y - padY);
    const w = Math.min(aw - x, block.width + padX * 2);
    const h = Math.min(ah - y, block.height + padY + extraBottom);

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

  // Drop slivers next to a dominant block, but keep wide thin strips —
  // that is what an MRZ looks like when it segmented separately.
  const largestArea = regions.reduce(
    (max, r) => Math.max(max, r.width * r.height),
    0
  );
  const kept = regions.filter((r) => {
    const areaRatio = (r.width * r.height) / largestArea;
    if (areaRatio >= 0.22) return true;
    const aspect = r.width / Math.max(1, r.height);
    return aspect >= 8 && r.width >= fullWidth * 0.35;
  });

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
