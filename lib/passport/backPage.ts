/**
 * Parser for the back page of an Indian passport.
 *
 * Layout (labels are bilingual, so OCR often mangles them):
 *   Name of Father / Legal Guardian
 *   Name of Mother
 *   Name of Spouse
 *   Address
 *   Old Passport No. with Date and Place of Issue
 *   File No.
 */

export interface BackPageDetails {
  fathersName?: string;
  mothersName?: string;
  spouseName?: string;
  address?: string;
  fileNumber?: string;
  oldPassportNumber?: string;
  oldPassportDateOfIssue?: string;
  oldPassportPlaceOfIssue?: string;
  dateOfIssue?: string;
}

const LABEL_PATTERNS: Record<string, RegExp> = {
  father: /NAME\s*OF\s*FATHER|FATHER'?S?\s*NAME|LEGAL\s*GUARDIAN/i,
  mother: /NAME\s*OF\s*MOTHER|MOTHER'?S?\s*NAME/i,
  spouse: /NAME\s*OF\s*SPOUSE|SPOUSE'?S?\s*NAME|HUSBAND|WIFE/i,
  address: /^\s*ADDRESS|\bADDRESS\b/i,
  oldPassport: /OLD\s*PASSPORT|PREVIOUS\s*PASSPORT/i,
  file: /FILE\s*(?:NO|NUMBER)/i,
};

const NAME_STOPWORDS =
  /FATHER|MOTHER|SPOUSE|GUARDIAN|ADDRESS|NAME|PASSPORT|FILE|INDIA|REPUBLIC|PIN|ROAD|COLONY|NAGAR|STREET|FLAT|SECTOR|BLOCK|DISTRICT|POST|HOLDER|SIGNATURE|OBSERVATION|EMIGRATION|PLACE|DATE|ISSUE/i;

/**
 * Labels that only ever appear on the back page. Without one of these the
 * text is not a back page, and guessing names from line order would happily
 * copy the holder's own name off the data page.
 */
const BACK_PAGE_EVIDENCE: RegExp[] = [
  /NAME\s*OF\s*FATHER/i,
  /FATHER'?S?\s*NAME/i,
  /LEGAL\s*GUARDIAN/i,
  /NAME\s*OF\s*MOTHER/i,
  /MOTHER'?S?\s*NAME/i,
  /NAME\s*OF\s*SPOUSE/i,
  /OLD\s*PASSPORT/i,
  /FILE\s*(?:NO|NUMBER)/i,
  /PIN\s*[:\-]?\s*\d{6}/i,
];

/** Printed only on the data page — proof this text is NOT a back page. */
const FRONT_PAGE_EVIDENCE: RegExp[] = [
  /GIVEN\s*NAME/i,
  /DATE\s*OF\s*EXPIRY/i,
  /PLACE\s*OF\s*ISSUE/i,
  /P<[A-Z]{3}/,
];

/**
 * True when the text carries at least one back-page-only label.
 * Callers use this to decide whether order-based name guessing is safe.
 */
export function hasBackPageEvidence(text: string): boolean {
  const compact = text.replace(/\s+/g, ' ');
  return BACK_PAGE_EVIDENCE.some((pattern) => pattern.test(compact));
}

/** True when the text is the data page (so back-page fields must not be guessed). */
export function looksLikeFrontPage(text: string): boolean {
  const compact = text.replace(/\s+/g, ' ');
  return FRONT_PAGE_EVIDENCE.some((pattern) => pattern.test(compact));
}

function cleanLine(line: string): string {
  return line.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Drop Devanagari noise and label-only fragments. */
function usefulLines(text: string): string[] {
  return text
    .replace(/\r/g, '\n')
    .split('\n')
    .map(cleanLine)
    .filter((line) => {
      if (line.length < 3) return false;
      const letters = (line.match(/[A-Za-z0-9]/g) || []).length;
      return letters >= line.length * 0.5;
    });
}

function isLabelLine(line: string): boolean {
  return Object.values(LABEL_PATTERNS).some((pattern) => pattern.test(line));
}

function looksLikePersonName(line: string): boolean {
  const value = line
    .replace(/[^A-Za-z .']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (value.length < 4 || value.length > 40) return false;
  if (NAME_STOPWORDS.test(value)) return false;
  const consonants = value.replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, '');
  if (consonants.length < 2) return false;
  const words = value.split(' ');
  if (words.length < 1 || words.length > 5) return false;
  if (words.some((word) => word.length < 2)) return false;
  return words.some((word) => word.length >= 4);
}

function looksLikeAddressLine(line: string): boolean {
  if (/PIN\s*[:\-]?\s*\d{5,6}/i.test(line)) return true;
  if (/\d/.test(line) && /[A-Za-z]{3,}/.test(line)) return true;
  return /,/.test(line) && /[A-Za-z]{3,}/.test(line);
}

function normalizeName(line: string): string {
  return line
    .replace(/[^A-Za-z .']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function toIsoDate(day: string, month: string, year: string): string {
  const dd = day.padStart(2, '0');
  const mm = month.padStart(2, '0');
  let yyyy = year;
  if (yyyy.length === 2) {
    const value = Number(yyyy);
    yyyy = String(value > 50 ? 1900 + value : 2000 + value);
  }
  if (Number(mm) < 1 || Number(mm) > 12) return '';
  if (Number(dd) < 1 || Number(dd) > 31) return '';
  return `${yyyy}-${mm}-${dd}`;
}

export interface BackPageOptions {
  /** Stops the current number (also printed on the back) reading as the old one. */
  currentPassportNumber?: string;
  /**
   * The holder's own name from the MRZ. A back page never repeats it, so any
   * candidate matching it is data-page bleed and must be dropped.
   */
  holderNames?: string[];
  /**
   * Allow guessing father/mother from line order when the bilingual labels
   * were lost to OCR noise. Only safe on a page proven to be the back page.
   */
  allowPositionalNames?: boolean;
}

/**
 * The holder's own full name, or their given names alone, leaking off the
 * data page. The surname by itself is not enough — in India the father's
 * given name is often the child's surname (CHINNASWAMY / CHINNASWAMY).
 */
function isHolderName(candidate: string, holderNames?: string[]): boolean {
  const normalized = normalizeName(candidate);
  if (!normalized) return false;
  const surname = normalizeName(holderNames?.[0] || '');
  const given = normalizeName(holderNames?.[1] || '');
  const full = [surname, given].filter(Boolean).join(' ');
  if (full && normalized === full) return true;
  if (given && normalized === given) return true;
  return false;
}

/**
 * Extract every field printed on the back page.
 *
 * Only call this with text that actually came from a back page — check with
 * `hasBackPageEvidence` first. Given data-page text it would otherwise read
 * the holder's own surname and given names as father and mother.
 */
export function extractBackPageDetails(
  text: string,
  options?: BackPageOptions
): BackPageDetails {
  const lines = usefulLines(text);
  const joined = lines.join('\n');
  const current = (options?.currentPassportNumber || '').toUpperCase();
  const holderNames = options?.holderNames;

  const details: BackPageDetails = {};
  const usedIndexes = new Set<number>();

  const isParentName = (value: string) =>
    looksLikePersonName(value) && !isHolderName(value, holderNames);

  // Labelled values: take the first plausible name after the label line
  const valueAfterLabel = (pattern: RegExp): number => {
    for (let i = 0; i < lines.length; i += 1) {
      if (!pattern.test(lines[i])) continue;
      const inline = lines[i].split(/[:\-]\s*/).slice(1).join(' ').trim();
      if (inline && isParentName(inline)) return i;
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j += 1) {
        if (isLabelLine(lines[j])) continue;
        if (isParentName(lines[j])) return j;
      }
    }
    return -1;
  };

  const fatherIndex = valueAfterLabel(LABEL_PATTERNS.father);
  const motherIndex = valueAfterLabel(LABEL_PATTERNS.mother);
  const spouseIndex = valueAfterLabel(LABEL_PATTERNS.spouse);

  if (fatherIndex >= 0) {
    details.fathersName = normalizeName(lines[fatherIndex]);
    usedIndexes.add(fatherIndex);
  }
  if (motherIndex >= 0 && motherIndex !== fatherIndex) {
    details.mothersName = normalizeName(lines[motherIndex]);
    usedIndexes.add(motherIndex);
  }
  if (
    spouseIndex >= 0 &&
    spouseIndex !== fatherIndex &&
    spouseIndex !== motherIndex
  ) {
    details.spouseName = normalizeName(lines[spouseIndex]);
    usedIndexes.add(spouseIndex);
  }

  // Old passport: number, date and place appear together on one line
  const oldPassport = joined.match(
    /\b([A-Z]\d{7}|[A-Z]{2}\d{6,7})\b[^\n\dA-Z]{0,6}(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})[^\nA-Z]{0,6}([A-Z][A-Z .]{2,25})?/
  );
  if (oldPassport && oldPassport[1].toUpperCase() !== current) {
    details.oldPassportNumber = oldPassport[1].toUpperCase();
    const iso = toIsoDate(oldPassport[2], oldPassport[3], oldPassport[4]);
    if (iso) details.oldPassportDateOfIssue = iso;
    const place = (oldPassport[5] || '').trim();
    if (place && !NAME_STOPWORDS.test(place)) {
      details.oldPassportPlaceOfIssue = place.replace(/\s+/g, ' ').toUpperCase();
    }
  }

  // File number: labelled, or the long alphanumeric token near the bottom
  const labelledFile = joined.match(
    /FILE\s*(?:NO|NUMBER)\.?\s*[:\-]?\s*([A-Z0-9]{8,20})/i
  );
  if (labelledFile) {
    details.fileNumber = labelledFile[1].toUpperCase();
  } else {
    for (const line of lines) {
      const token = line.replace(/\s+/g, '');
      if (
        /^[A-Z]{2}\d{2}[A-Z]?\d{8,16}$/.test(token) &&
        token !== current &&
        token !== details.oldPassportNumber
      ) {
        details.fileNumber = token;
        break;
      }
    }
  }

  // Address: the PIN line plus the lines directly above it
  const pinIndex = lines.findIndex((line) =>
    /PIN\s*[:\-]?\s*\d{5,6}/i.test(line)
  );
  if (pinIndex >= 0) {
    const parts: string[] = [];
    for (let i = pinIndex - 1; i >= 0 && parts.length < 3; i -= 1) {
      const line = lines[i];
      if (usedIndexes.has(i) || isLabelLine(line)) break;
      if (!looksLikeAddressLine(line)) break;
      parts.unshift(line);
    }
    parts.push(lines[pinIndex]);
    details.address = parts
      .join(', ')
      .replace(/\s*,\s*/g, ', ')
      .replace(/,\s*,/g, ',')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  } else {
    const addressLabel = lines.findIndex((line) =>
      LABEL_PATTERNS.address.test(line)
    );
    if (addressLabel >= 0) {
      const parts: string[] = [];
      for (
        let i = addressLabel + 1;
        i < lines.length && parts.length < 3;
        i += 1
      ) {
        if (isLabelLine(lines[i])) break;
        if (!looksLikeAddressLine(lines[i])) break;
        parts.push(lines[i]);
      }
      if (parts.length) {
        details.address = parts.join(', ').replace(/\s+/g, ' ').toUpperCase();
      }
    }
  }

  // Positional fallback — Indian back pages list father, mother, spouse in
  // order. Opt-in only: on data-page text this would return the holder's name.
  if (
    options?.allowPositionalNames &&
    (!details.fathersName || !details.mothersName)
  ) {
    const candidates: string[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (usedIndexes.has(i)) continue;
      if (details.address && details.address.includes(lines[i].toUpperCase())) {
        continue;
      }
      if (isParentName(lines[i])) candidates.push(normalizeName(lines[i]));
      if (candidates.length >= 3) break;
    }
    if (!details.fathersName) details.fathersName = candidates.shift();
    if (!details.mothersName) details.mothersName = candidates.shift();
  }

  return details;
}
