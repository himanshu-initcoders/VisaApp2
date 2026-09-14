/**
 * Turn whatever the user uploaded into a ranked list of upright candidate
 * document pages.
 *
 * The uploads in the sample corpus include a 10-page booklet scan, a single
 * sheet holding a whole open booklet plus a notary stamp, pages flagged
 * landscape whose content is portrait, visa pages carrying their own MRZ, and
 * phone photos of a passport lying on a desk. None of that is exceptional, so
 * page choice is decided by evidence rather than by position: a page earns its
 * rank from how strongly it looks like it holds a passport MRZ.
 *
 * PDFs are rasterized twice. Every page is rendered small enough to be cheap,
 * scored, and thrown away; only the winners are re-rendered at the resolution
 * OCR needs. That keeps a 10-page upload affordable while making page 7 just
 * as reachable as page 1.
 */

import { normalizeDocumentPages } from './documentRegion';
import {
  deskewCanvas,
  rotateCanvas,
  sourceSize,
  type Rotation,
} from './imageOps';
import { findMrzBands, type MrzBandCandidate } from './mrzLocate';
import { guessOrientation } from './orientation';
import {
  choosePagesToPromote,
  keepCandidateCrops,
  textLayerSignals,
} from './pageSelect';
import {
  isPdfFile,
  rasterizePdfPages,
  type RasterizedPage,
} from './pdfToImage';

/** Cheap enough to run over every page of a long PDF. */
const TRIAGE_MAX_EDGE = 1100;
/** Enough pixels per MRZ character for OCR-B to be read reliably. */
const OCR_MAX_EDGE = 2600;

export interface CandidatePage {
  /** Stable id so the extractor can drop the winning crop without object identity. */
  id: string;
  /** 1-based source page. Always 1 for a plain image upload. */
  pageNumber: number;
  /** How many pages the original upload had. Needed to prefer the last page. */
  sourcePageCount: number;
  /** Upright, deskewed crop ready for OCR. */
  canvas: HTMLCanvasElement;
  /** Quarter turn applied to get here. */
  rotation: Rotation;
  /** Remaining rotations to try if the MRZ does not read at `rotation`. */
  fallbackRotations: Rotation[];
  mrzBand?: MrzBandCandidate;
  /** MRZ-likeness. Comparable across candidates from the same upload. */
  bandScore: number;
  /** Embedded PDF text for this page, when the file had any. */
  textLayer: string;
}

function isCanvas(value: unknown): value is HTMLCanvasElement {
  return typeof HTMLCanvasElement !== 'undefined' && value instanceof HTMLCanvasElement;
}

async function decodeImage(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

async function isPdf(input: File | Blob): Promise<boolean> {
  if (isPdfFile(input)) return true;
  const header = new Uint8Array(await input.slice(0, 5).arrayBuffer());
  return (
    header[0] === 0x25 &&
    header[1] === 0x50 &&
    header[2] === 0x44 &&
    header[3] === 0x46
  );
}

/**
 * Crop the documents out of one rendered sheet and orient each one.
 * A scanned A4 with a small passport on it needs the crop before anything
 * else; an already-tight data page comes back essentially unchanged.
 */
function cropsFromPage(
  page: RasterizedPage,
  sourcePageCount: number
): CandidatePage[] {
  const crops = normalizeDocumentPages(page.canvas, {
    targetWidth: 1800,
    maxRegions: 3,
  });

  return crops.map((crop, cropIndex) => {
    const guess = guessOrientation(crop);
    const [rotation, ...fallbackRotations] = guess.rotations;

    // Orient first, then take the skew out, then re-find the band in the
    // frame the extractor will actually crop from.
    const oriented = rotateCanvas(crop, rotation);
    const band = findMrzBands(oriented)[0];
    let canvas = oriented;
    let mrzBand = band;
    // Deskew only when it still leaves an MRZ-shaped band. On phone photos a
    // large skew estimate is usually the table, and deskewing it wipes the MRZ.
    if (band && Math.abs(band.skew) > 0.4 && Math.abs(band.skew) < 6) {
      const deskewed = deskewCanvas(oriented, -band.skew);
      const after = findMrzBands(deskewed)[0];
      if (after) {
        canvas = deskewed;
        mrzBand = after;
      }
    }

    return {
      id: `${page.pageNumber}:${cropIndex}`,
      pageNumber: page.pageNumber,
      sourcePageCount,
      canvas,
      rotation,
      fallbackRotations,
      mrzBand,
      bandScore: mrzBand?.score ?? guess.bandScore,
      textLayer: page.textLayer,
    };
  });
}

/**
 * Rank the candidate document pages in an upload, best first.
 * The caller confirms the winner by actually reading its MRZ.
 */
export async function selectCandidatePages(
  input: File | Blob | HTMLCanvasElement
): Promise<CandidatePage[]> {
  let pages: RasterizedPage[];

  let sourcePageCount = 1;

  if (isCanvas(input)) {
    pages = [{ pageNumber: 1, canvas: input, textLayer: '' }];
  } else if (await isPdf(input)) {
    const triage = await rasterizePdfPages(input, { maxEdge: TRIAGE_MAX_EDGE });
    if (!triage.length) return [];
    sourcePageCount = triage.length;

    // Score every page cheaply, then re-render the data page, its neighbours
    // and the last page rather than the top-N MRZ hits (those are often visas).
    const ranked = triage.map((page) => {
      const best = cropsFromPage(page, sourcePageCount).reduce(
        (max, crop) => Math.max(max, crop.bandScore),
        0
      );
      const signals = textLayerSignals(page.textLayer);
      return {
        pageNumber: page.pageNumber,
        mrzScore: best + signals.mrzBonus,
        backScore: signals.backScore,
      };
    });

    pages = await rasterizePdfPages(input, {
      pages: choosePagesToPromote(ranked, sourcePageCount),
      maxEdge: OCR_MAX_EDGE,
    });
  } else {
    pages = [{ pageNumber: 1, canvas: await decodeImage(input), textLayer: '' }];
  }

  const candidates = pages
    .flatMap((page) => cropsFromPage(page, sourcePageCount))
    .filter((candidate) => {
      const { width, height } = sourceSize(candidate.canvas);
      return width >= 200 && height >= 140;
    });

  return keepCandidateCrops(candidates, sourcePageCount).sort(
    (a, b) => b.bandScore - a.bandScore
  );
}
