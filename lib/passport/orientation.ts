/**
 * Work out which way up a scanned page is.
 *
 * Generic approaches are unreliable here: Tesseract's OSD is noisy on ID
 * documents, and ranking rotations by OCR confidence famously scores an
 * upside-down page higher than an upright one, because the engine finds
 * plausible words either way.
 *
 * A passport gives us something much better. The MRZ band has a distinctive
 * shape, so image analysis alone separates the two upright rotations from the
 * two sideways ones without any OCR. That leaves only the 180° question, and
 * there the MRZ itself is the oracle: `P<IND` and four ICAO check digits read
 * correctly in exactly one of the two. So we spend zero OCR passes narrowing
 * to a pair, and let the parser settle the rest.
 */

import { rotateCanvas, sourceSize, type Rotation } from './imageOps';
import { findMrzBands, mrzBandScore, type MrzBandCandidate } from './mrzLocate';

type ImageSource = HTMLCanvasElement | HTMLImageElement;

/** How much better the sideways reading must be before we believe it. */
const BAND_SCORE_MARGIN = 1.02;

export interface OrientationGuess {
  /** Rotations to try, best first. Always all four, so nothing is unreachable. */
  rotations: Rotation[];
  /** Best band score seen, for ranking one crop against another. */
  bandScore: number;
  /** Whether an MRZ-shaped band was found at all. */
  hasMrzBand: boolean;
}

/**
 * Rank the four quarter turns without running OCR.
 *
 * Only 0° and 90° are measured: 180° has the same band geometry as 0°, and
 * 270° the same as 90°, so a third and fourth measurement would tell us
 * nothing that the MRZ parse will not tell us more reliably.
 */
export function guessOrientation(source: ImageSource): OrientationGuess {
  const upright = mrzBandScore(source);
  const sideways = mrzBandScore(rotateCanvas(source, 90));
  const { width, height } = sourceSize(source);
  const alreadyPortrait = height > width * 1.15;

  // A landscape phone photo is already upright; a high sideways score is
  // almost always floorboards or a table edge. Portrait A4 with a sideways
  // passport is the opposite: the real MRZ only appears after a 90° turn.
  const preferSideways =
    sideways > 0 &&
    sideways > upright * BAND_SCORE_MARGIN &&
    (alreadyPortrait || upright > 0);

  return {
    rotations: preferSideways ? [90, 0, 270, 180] : [0, 90, 180, 270],
    bandScore: Math.max(upright, sideways),
    hasMrzBand: Math.max(upright, sideways) > 0,
  };
}

export interface OrientedPage {
  canvas: HTMLCanvasElement;
  rotation: Rotation;
  mrzBand?: MrzBandCandidate;
}

/**
 * Apply a rotation and return the MRZ band located in that frame, so callers
 * do not have to re-detect it after rotating.
 */
export function orientPage(
  source: ImageSource,
  rotation: Rotation
): OrientedPage {
  const canvas = rotateCanvas(source, rotation);
  return { canvas, rotation, mrzBand: findMrzBands(canvas)[0] };
}
