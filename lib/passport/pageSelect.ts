/**
 * Decide which pages of an upload are worth reading, without looking at pixels.
 *
 * Ranking by MRZ-likeness alone is how a 10-page booklet loses its last page
 * (the one with father/mother) to visa stamps, and how a 3-page file that
 * starts with the back page never gets that back page OCR'd. Page choice has
 * to keep both the data page and the pages that typically sit next to it.
 */

export interface PageSignals {
  pageNumber: number;
  /** Geometric MRZ-likeness plus any embedded-text bonus. */
  mrzScore: number;
  /** Embedded-text evidence that this is the last (particulars) page. */
  backScore: number;
}

export interface BackPageRankInput {
  pageNumber: number;
  bandScore: number;
  textLayer: string;
}

/** Short PDFs are cheap enough to render in full. */
export const SMALL_PDF_PAGE_LIMIT = 4;

/**
 * Signals we can take from an embedded PDF text layer. Scanner OCR is noisy,
 * so these are bonuses, never the only reason a page is kept or dropped.
 */
export function textLayerSignals(textLayer: string): {
  mrzBonus: number;
  backScore: number;
} {
  const compact = textLayer.replace(/\s+/g, '').toUpperCase();
  let mrzBonus = 0;
  let backScore = 0;

  if (/P<[A-Z]{3}/.test(compact)) mrzBonus += 30;
  if (/REPUBLICOFINDIA/.test(compact)) mrzBonus += 10;
  if (/(?:VISUM|SCHENGEN)/.test(compact) && !/P<[A-Z]{3}/.test(compact)) {
    mrzBonus -= 20;
  }
  if (/NAMEOFFATHER|NAMEOFMOTHER|LEGALGUARDIAN/.test(compact)) backScore += 20;
  if (/OLDPASSPORT/.test(compact)) backScore += 10;
  if (/PIN\d{6}/.test(compact)) backScore += 8;

  return { mrzBonus, backScore };
}

/**
 * Pages to re-render at OCR resolution.
 *
 * A 2- or 3-page upload (front, back, maybe a visa) is always read in full.
 * A long booklet keeps the strongest MRZ pages, their neighbours, and the
 * first and last pages — the last page of an Indian passport is the
 * particulars page.
 */
export function choosePagesToPromote(
  ranked: PageSignals[],
  pageCount: number
): number[] {
  if (pageCount <= 0) return [];
  if (pageCount <= SMALL_PDF_PAGE_LIMIT) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const promoted = new Set<number>();
  const byMrz = [...ranked].sort((a, b) => b.mrzScore - a.mrzScore);
  const byBack = [...ranked].sort((a, b) => b.backScore - a.backScore);

  for (const entry of byMrz.slice(0, 2)) promoted.add(entry.pageNumber);

  const best = byMrz[0];
  if (best) {
    if (best.pageNumber > 1) promoted.add(best.pageNumber - 1);
    if (best.pageNumber < pageCount) promoted.add(best.pageNumber + 1);
  }

  promoted.add(1);
  promoted.add(pageCount);

  for (const entry of byBack) {
    if (entry.backScore > 0) promoted.add(entry.pageNumber);
  }

  return [...promoted]
    .filter((pageNumber) => pageNumber >= 1 && pageNumber <= pageCount)
    .sort((a, b) => a - b);
}

/**
 * After the data page is known, rank remaining crops so the particulars page
 * is read before a visa page that also happens to have an MRZ.
 */
export function scoreBackPageCandidate(
  candidate: BackPageRankInput,
  dataPageNumber: number,
  pageCount: number
): number {
  const { backScore } = textLayerSignals(candidate.textLayer);
  let score = backScore;

  if (pageCount > 1 && candidate.pageNumber === pageCount) score += 20;
  if (Math.abs(candidate.pageNumber - dataPageNumber) === 1) score += 15;
  if (candidate.pageNumber === 1 && dataPageNumber !== 1) score += 6;
  // No MRZ is a positive signal for the last page; a second MRZ is usually a visa.
  if (candidate.bandScore < 15) score += 10;
  if (candidate.bandScore > 40) score -= 18;

  return score;
}

export function rankBackPageCandidates<T extends BackPageRankInput>(
  candidates: T[],
  dataPageNumber: number,
  pageCount: number
): T[] {
  return [...candidates].sort(
    (a, b) =>
      scoreBackPageCandidate(b, dataPageNumber, pageCount) -
      scoreBackPageCandidate(a, dataPageNumber, pageCount)
  );
}

/**
 * Keep the data-page crops and the pages that might be the back, even when
 * those back-page crops score poorly on MRZ geometry.
 */
export function keepCandidateCrops<T extends { pageNumber: number; bandScore: number }>(
  candidates: T[],
  pageCount: number
): T[] {
  if (candidates.length <= 8) return candidates;

  const kept = new Set<T>();
  const byMrz = [...candidates].sort((a, b) => b.bandScore - a.bandScore);
  byMrz.slice(0, 3).forEach((candidate) => kept.add(candidate));

  const bestPage = byMrz[0]?.pageNumber;
  for (const candidate of candidates) {
    if (candidate.pageNumber === 1 || candidate.pageNumber === pageCount) {
      kept.add(candidate);
    }
    if (bestPage && Math.abs(candidate.pageNumber - bestPage) === 1) {
      kept.add(candidate);
    }
  }

  return [...kept];
}
