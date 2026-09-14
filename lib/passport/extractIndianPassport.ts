import { parse as parseMrz } from 'mrz';
import Tesseract from 'tesseract.js';
import type { IndianPassportExtraction } from './types';
import { canvasToBlob } from './pdfToImage';
import {
  extractBackPageDetails,
  hasBackPageEvidence,
  looksLikeFrontPage,
  type BackPageDetails,
  type BackPageOptions,
} from './backPage';
import {
  binarizeCanvas,
  cropCanvas,
  findTextLineBands,
  padRect,
  rotateCanvas,
  sourceSize,
  type Rotation,
} from './imageOps';
import { mrzRegion } from './mrzLocate';
import { rankBackPageCandidates } from './pageSelect';
import { selectCandidatePages, type CandidatePage } from './pipeline';
import {
  createPassportOcr,
  MRZ_WHITELIST,
  type PassportOcr,
} from './ocr';

const TD3_LEN = 44;

export class IndianPassportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IndianPassportError';
  }
}

/**
 * Crop and binarize the MRZ band.
 *
 * The band is located by its shape, so this works on a booklet spread where
 * the MRZ sits mid-page and on a notarised copy with stamps printed below it.
 * `bottomRatio` is only the fallback for an image with no detectable band.
 */
export function detectMrzRegion(
  source: HTMLCanvasElement | HTMLImageElement,
  bottomRatio = 0.28
): HTMLCanvasElement {
  return binarizeCanvas(cropMrzBand(source, bottomRatio));
}

/** Color/grayscale MRZ crop — phone photos often binarize worse than they OCR. */
export function cropMrzBand(
  source: HTMLCanvasElement | HTMLImageElement,
  bottomRatio = 0.28
): HTMLCanvasElement {
  const { width, height } = sourceSize(source);
  const located = mrzRegion(source);
  const rect =
    located.rect.height > 0
      ? located.rect
      : {
          x: 0,
          y: height - Math.max(48, Math.floor(height * bottomRatio)),
          width,
          height: Math.max(48, Math.floor(height * bottomRatio)),
        };

  return cropCanvas(source, rect, Math.min(2600, Math.max(rect.width * 2, 2000)));
}

/**
 * One-off OCR pass. `mrzMode` selects the OCR-B model and the MRZ character
 * repertoire; without it the printed zone is read with English.
 */
export async function ocrText(
  image: HTMLCanvasElement | HTMLImageElement | Blob | File,
  options?: {
    mrzMode?: boolean;
    psm?: (typeof Tesseract.PSM)[keyof typeof Tesseract.PSM];
    ocr?: PassportOcr;
  }
): Promise<{ text: string; confidence: number }> {
  const ocr = options?.ocr ?? (await createPassportOcr());
  try {
    return await ocr.recognize(image, {
      language: options?.mrzMode ? 'ocrb' : 'eng',
      psm: options?.psm,
    });
  } finally {
    if (!options?.ocr) await ocr.terminate();
  }
}

function normalizeMrz(text: string): string {
  return text
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[«»‹›=_]/g, '<')
    .replace(/[^A-Z0-9<]/g, '');
}

function pad44(line: string): string {
  return line.slice(0, TD3_LEN).padEnd(TD3_LEN, '<');
}

/**
 * Rebuild TD3 line 1. Prefer existing << separator; otherwise reconstruct from tokens.
 */
/**
 * ICAO 9303 document type. Passports are P (P, PD diplomatic, PS service).
 * Visas are V (MRV-A / MRV-B) and ID cards are I/A/C (TD1/TD2) — a passport
 * parser must reject those rather than rewrite them.
 */
export function isPassportMrzLine(line: string): boolean {
  const s = normalizeMrz(line);
  if (s.length < 20) return false;
  // Postal PIN lines on the last page (PIN:500039,TELANGANA,INDIA) start with
  // P and must never be rewritten into a fake TD3.
  if (/^PIN\d{5,}/.test(s)) return false;
  // P / PD / PS, then a 3-letter country, then the start of a name — not a digit.
  return /^[PFR]<?[A-Z]{3}[A-Z]/.test(s);
}

export function correctMrzLine1(line: string): string {
  let s = normalizeMrz(line);
  if (s.startsWith('PIND')) s = `P<${s.slice(1)}`;
  // Only normalize to P< when the line really is a passport line. Forcing it
  // would turn an MRV-A visa line (VCAUT…) into a fake passport MRZ.
  if (!isPassportMrzLine(s)) return pad44(s);
  if (!s.startsWith('P<')) s = `P<${s.replace(/^[PFR]/, '')}`;

  // Ensure country code shape P<IND...
  if (!/^P<[A-Z]{3}/.test(s) && s.startsWith('P<')) {
    // leave as-is; validator handles
  }

  const m = s.match(/^P<([A-Z0-9]{3})(.*)$/);
  if (!m) return pad44(s);

  let country = m[1].replace(/0/g, 'O').replace(/1/g, 'I');
  if (country === 'IN0' || country === '1ND' || country === 'IHD') country = 'IND';
  // Strip trailing fillers so <<<... doesn't fake a name separator
  let rest = m[2].replace(/<+$/, '');

  // Real TD3 name separator is <<. A single < inside the surname is a space
  // (TIRUNELVELI<SARANGAPANI), not OCR junk — skipping that case used to
  // shove the second surname token into the given names.
  const sepAt = rest.indexOf('<<');
  if (sepAt >= 0) {
    const surnamePart = rest.slice(0, sepAt);
    const givenPart = rest.slice(sepAt + 2);
    const surname = surnamePart
      .split('<')
      .map((t) => t.replace(/[^A-Z]/g, ''))
      .filter((t) => t.length >= 2)
      .join('<');
    const given = givenPart
      .split('<')
      .map((t) => t.replace(/[^A-Z]/g, ''))
      .filter((t) => t.length >= 2)
      .join('<');
    if (surname) return pad44(`P<${country}${surname}<<${given}`);
  }

  // No clean << — OCR turned separators into C/K/L letters
  rest = rest.replace(/[CKL]{2,}/g, (x) => '<'.repeat(x.length));
  const tokens = rest
    .split('<')
    .map((t) => t.replace(/[^A-Z]/g, ''))
    .filter(Boolean)
    .map((t) => (/^[CK][A-Z]{3,}$/.test(t) ? t.slice(1) : t))
    .filter((t) => t.length >= 2 && !/^[CKL]+$/.test(t));

  const surname = tokens[0] || '';
  const given = tokens.slice(1).join('<');
  if (!surname) return pad44(`P<${country}${m[2]}`);
  return pad44(`P<${country}${surname}<<${given}`);
}

/**
 * Rebuild TD3 line 2 using Indian passport structure.
 */
export function correctMrzLine2(line: string): string {
  let s = normalizeMrz(line);
  s = s.replace(/O/g, '0').replace(/Q/g, '0');

  // Best path: full structural regex. Check digits are preserved verbatim —
  // they are what lets us repair OCR character confusions later.
  const full = s.match(
    /([A-Z]{1,2}\d{6,7})<?([0-9<])?IND(\d{6})([0-9<])?([MFX])(\d{6})([0-9<])?/
  );
  if (full) {
    const num = full[1].padEnd(9, '<').slice(0, 9);
    const check = /\d/.test(full[2] || '') ? full[2]! : '<';
    const birth = full[3];
    const birthCheck = /\d/.test(full[4] || '') ? full[4]! : '<';
    const sex = full[5];
    const expiry = full[6];
    const expiryCheck = /\d/.test(full[7] || '') ? full[7]! : '<';
    return pad44(
      `${num}${check}IND${birth}${birthCheck}${sex}${expiry}${expiryCheck}`
    );
  }

  // Fallback: locate IND and parse around it
  const indAt = s.indexOf('IND');
  if (indAt > 0) {
    const compactBefore = s.slice(0, indAt).replace(/[^A-Z0-9]/g, '');
    const num =
      compactBefore.length >= 9
        ? compactBefore.slice(0, -1)
        : compactBefore.slice(0, 8);
    const after = s.slice(indAt);
    const body = after.match(/^IND(\d{6})(\d?)([MFX])(\d{6})(\d?)/);
    if (body && num) {
      const beforeCheck = compactBefore.slice(-1);
      const check = /\d/.test(beforeCheck) ? beforeCheck : '<';
      return pad44(
        `${num.padEnd(9, '<').slice(0, 9)}${check}IND${body[1]}${body[2] || '<'}${body[3]}${body[4]}${body[5] || '<'}`
      );
    }
  }

  return pad44(s.replace(/L/g, '<'));
}

export function correctMrzOcrArtifacts(
  line: string,
  kind: 'line1' | 'line2'
): string {
  return kind === 'line1' ? correctMrzLine1(line) : correctMrzLine2(line);
}

/** Pull TD3 pair with regex from any OCR blob (most reliable). */
export function extractMrzPairFromText(ocrRaw: string): [string, string] | null {
  const blob = normalizeMrz(ocrRaw);
  const pIdx = blob.search(/P<[A-Z]{3}/);
  if (pIdx < 0) return null;

  // Cap line1 before a passport-number-shaped start of line 2
  let line1Raw = blob.slice(pIdx, pIdx + 55);
  // Prefer cut before ZA926446 / A1234567 after fillers
  const cut = line1Raw.search(/<{2,}[A-Z]{1,2}\d{6}/);
  if (cut > 12) {
    line1Raw = line1Raw.slice(0, cut);
  } else {
    const alt = line1Raw.search(/(?<=[A-Z<])([A-Z]{2}\d{6}|[A-Z]\d{7})/);
    // Only cut if this looks like line2 glued on (digits after names/fillers)
    if (alt > 20) line1Raw = line1Raw.slice(0, alt);
  }

  const line1 = correctMrzLine1(line1Raw);

  const after = blob.slice(pIdx + Math.min(30, line1Raw.length));
  const line2Match =
    after.match(/[A-Z]{1,2}\d{6,7}<?\d?IND\d{6}\d?[MFX]\d{6}[A-Z0-9<]*/) ||
    blob.match(/[A-Z]{1,2}\d{6,7}<?\d?IND\d{6}\d?[MFX]\d{6}[A-Z0-9<]*/);

  if (!line2Match) return null;
  const line2 = correctMrzLine2(line2Match[0]);
  return [line1, line2];
}

export function findTd3MrzLines(ocrRaw: string): [string, string] | null {
  const fromRegex = extractMrzPairFromText(ocrRaw);
  if (fromRegex) return fromRegex;

  const rawLines = ocrRaw
    .split(/\r?\n/)
    .map((l) => normalizeMrz(l))
    .filter((l) => l.length >= 20);

  const line1 = rawLines.find((l) => isPassportMrzLine(l));
  const line2 = rawLines.find(
    (l) =>
      !isPassportMrzLine(l) &&
      /[A-Z]{0,2}\d{6,}/.test(l) &&
      (l.includes('IND') || /[MFX]/.test(l))
  );

  if (line1 && line2) {
    return [correctMrzLine1(line1), correctMrzLine2(line2)];
  }
  return null;
}

export function mrzDateToIso(yymmdd: string, kind: 'birth' | 'expiry'): string {
  const cleaned = yymmdd.replace(/\D/g, '');
  if (!/^\d{6}$/.test(cleaned)) return '';
  const yy = Number(cleaned.slice(0, 2));
  const mm = cleaned.slice(2, 4);
  const dd = cleaned.slice(4, 6);
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return '';
  const nowYy = new Date().getFullYear() % 100;
  const century =
    kind === 'expiry'
      ? yy <= nowYy + 40
        ? 2000
        : 1900
      : yy > nowYy + 1
        ? 1900
        : 2000;
  return `${century + yy}-${mm}-${dd}`;
}

export function parseTd3Manually(lines: [string, string]) {
  const line1 = correctMrzLine1(lines[0]);
  const line2 = correctMrzLine2(lines[1]);

  const countryOfIssue = line1.slice(2, 5).replace(/</g, '');
  const nameRest = line1.slice(5);
  const [surRaw, givenRaw = ''] = nameRest.split('<<');
  const surname = surRaw
    .split('<')
    .map((p) => p.replace(/[^A-Z]/g, ''))
    .filter((p) => p.length >= 2)
    .join(' ');
  const givenNames = givenRaw
    .split('<')
    .map((p) => p.replace(/[^A-Z]/g, ''))
    .filter((p) => p.length >= 2)
    .join(' ');

  const passportNumber = line2.slice(0, 9).replace(/</g, '');
  const nationality = line2.slice(10, 13).replace(/</g, '');
  const dateOfBirth = mrzDateToIso(line2.slice(13, 19), 'birth');
  const sexChar = line2.slice(20, 21);
  const sex: '' | 'M' | 'F' | 'X' =
    sexChar === 'M' || sexChar === 'F' || sexChar === 'X' ? sexChar : '';
  const dateOfExpiry = mrzDateToIso(line2.slice(21, 27), 'expiry');

  return {
    line1,
    line2,
    documentType: 'P',
    countryOfIssue,
    surname,
    givenNames,
    passportNumber,
    nationality,
    dateOfBirth,
    sex,
    dateOfExpiry,
  };
}

function sanitizePersonName(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(
      (token) =>
        token.length >= 2 &&
        !/^[EILCKT]{2,3}$/.test(token) &&
        !/[BCDFGHJKLMNPQRSTVWXYZ]{6,}/.test(token)
    )
    .join(' ');
}

function looksLikeGarbageName(value: string): boolean {
  if (!value) return true;
  if (value.length === 1) return true;
  // Indian given names can be a long compound (Dilip's is 35 characters).
  if (value.length > 60) return true;
  if (/[LCK]{4,}/.test(value)) return true;
  const fillers = (value.match(/[LCK]/g) || []).length;
  if (fillers > value.length / 2) return true;
  return false;
}

function looksLikeGarbagePassportNumber(value: string): boolean {
  if (!value) return true;
  if (/[LCK]/.test(value)) return true;
  return !/^[A-Z]\d{7}$/.test(value) && !/^[A-Z]{2}\d{6,7}$/.test(value);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** ICAO 9303 check digit: weights 7-3-1, letters A=10…Z=35, filler = 0. */
export function mrzCheckDigit(field: string): string {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < field.length; i += 1) {
    const code = field.charCodeAt(i);
    let value = 0;
    if (code >= 48 && code <= 57) value = code - 48;
    else if (code >= 65 && code <= 90) value = code - 55;
    sum += value * weights[i % 3];
  }
  return String(sum % 10);
}

/**
 * Characters OCR swaps in the MRZ font (Z read as I, 0 as O, 8 as B…).
 * Used only to propose alternatives that the check digit then confirms.
 */
const OCR_CONFUSIONS: Record<string, string> = {
  '0': 'ODQU',
  O: '0DQ',
  D: '0O',
  Q: '0O',
  U: '0V',
  '1': 'ILTJ',
  I: '1LTJZ',
  L: '1I',
  J: '1I',
  T: '17',
  '2': 'Z7',
  Z: '27I',
  '3': '89',
  '4': 'A',
  A: '4',
  '5': 'S6',
  S: '5',
  '6': 'G85',
  G: '6C',
  C: 'G6',
  '7': '1TZ',
  '8': 'B63',
  B: '8R',
  R: '8B',
  '9': '43',
  M: 'HN',
  N: 'MH',
  V: 'UY',
  Y: 'V',
};

/**
 * Repair a single mis-read character using the field's MRZ check digit.
 * Returns null unless exactly one plausible candidate matches, so a bad
 * guess can never silently replace a good reading.
 */
export function repairWithCheckDigit(
  field: string,
  checkDigit: string,
  isPlausible: (candidate: string) => boolean
): string | null {
  if (!/^\d$/.test(checkDigit)) return null;
  if (mrzCheckDigit(field) === checkDigit && isPlausible(field)) return field;

  const matches = new Set<string>();
  for (let i = 0; i < field.length; i += 1) {
    const alternatives = OCR_CONFUSIONS[field[i]];
    if (!alternatives) continue;
    for (const alternative of alternatives) {
      if (alternative === field[i]) continue;
      const candidate =
        field.slice(0, i) + alternative + field.slice(i + 1);
      if (
        mrzCheckDigit(candidate) === checkDigit &&
        isPlausible(candidate)
      ) {
        matches.add(candidate);
      }
    }
  }

  return matches.size === 1 ? [...matches][0] : null;
}

/**
 * TD3 composite check digit (ICAO 9303 Part 4): covers the document number
 * field, the birth date field and the optional-data field, and is the single
 * strongest signal that a whole line 2 was read correctly.
 */
export function td3CompositeCheckDigit(line2: string): string {
  const padded = pad44(line2);
  return mrzCheckDigit(
    padded.slice(0, 10) + padded.slice(13, 20) + padded.slice(21, 43)
  );
}

export interface Td3Validation {
  /** Line 1 declares a passport, not a visa or ID card. */
  isPassportType: boolean;
  /** Line 2 matches the TD3 field layout. */
  hasTd3Layout: boolean;
  numberCheckOk: boolean;
  birthCheckOk: boolean;
  expiryCheckOk: boolean;
  compositeCheckOk: boolean;
  /** How many of the four check digits verified. */
  checksPassed: number;
}

/**
 * Structural verdict on a TD3 pair. Used both to reject non-passport MRZs and
 * to rank competing OCR readings of the same passport.
 */
export function validateTd3(lines: [string, string]): Td3Validation {
  const line1 = pad44(normalizeMrz(lines[0]));
  const line2 = pad44(normalizeMrz(lines[1]));

  const numberCheckOk = mrzCheckDigit(line2.slice(0, 9)) === line2.slice(9, 10);
  const birthCheckOk = mrzCheckDigit(line2.slice(13, 19)) === line2.slice(19, 20);
  const expiryCheckOk = mrzCheckDigit(line2.slice(21, 27)) === line2.slice(27, 28);
  const compositeCheckOk = td3CompositeCheckDigit(line2) === line2.slice(43, 44);

  return {
    isPassportType: isPassportMrzLine(lines[0]),
    hasTd3Layout: /^[A-Z0-9<]{9}[0-9<][A-Z<]{3}\d{6}[0-9<][MFX<]\d{6}/.test(line2),
    numberCheckOk,
    birthCheckOk,
    expiryCheckOk,
    compositeCheckOk,
    checksPassed: [
      numberCheckOk,
      birthCheckOk,
      expiryCheckOk,
      compositeCheckOk,
    ].filter(Boolean).length,
  };
}

function isPlausibleIndianNumberField(candidate: string): boolean {
  return /^[A-Z]{1,2}\d{6,7}<*$/.test(candidate);
}

function isPlausibleMrzDate(candidate: string): boolean {
  if (!/^\d{6}$/.test(candidate)) return false;
  const month = Number(candidate.slice(2, 4));
  const day = Number(candidate.slice(4, 6));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

export function parseAndValidateMrz(lines: [string, string]) {
  // A visa or ID-card MRZ carries an IND nationality too, so it would sail
  // through the India gate below and overwrite the passport fields.
  if (!isPassportMrzLine(lines[0])) {
    throw new IndianPassportError(
      'This looks like a visa or ID card page, not the passport data page'
    );
  }

  const corrected: [string, string] = [
    correctMrzLine1(lines[0]),
    correctMrzLine2(lines[1]),
  ];
  const structure = validateTd3(corrected);
  const manual = parseTd3Manually(corrected);

  let result: ReturnType<typeof parseMrz> | null = null;
  try {
    result = parseMrz(corrected);
  } catch {
    result = null;
  }

  const fields = result?.fields || {};
  const issuing = (
    fields.issuingState ||
    manual.countryOfIssue ||
    corrected[0].slice(2, 5)
  ).toUpperCase();
  const nationality = (
    fields.nationality ||
    manual.nationality ||
    ''
  ).toUpperCase();

  const hasIndia =
    issuing === 'IND' ||
    nationality === 'IND' ||
    corrected[0].includes('IND') ||
    corrected[1].includes('IND');
  if (!hasIndia) {
    throw new IndianPassportError('Only Indian passports are supported');
  }

  const sexRaw = String(fields.sex || manual.sex || '').toUpperCase();
  let sex: '' | 'M' | 'F' | 'X' = manual.sex;
  if (sexRaw === 'M' || sexRaw.startsWith('MALE')) sex = 'M';
  else if (sexRaw === 'F' || sexRaw.startsWith('FEMALE')) sex = 'F';
  else if (sexRaw === 'X') sex = 'X';

  // Prefer manual positional names — more reliable than library when OCR is noisy
  let surname = sanitizePersonName(manual.surname);
  let givenNames = sanitizePersonName(manual.givenNames);
  if (looksLikeGarbageName(surname) && fields.lastName) {
    surname = sanitizePersonName(fields.lastName);
  }
  if (looksLikeGarbageName(givenNames) && fields.firstName) {
    givenNames = sanitizePersonName(fields.firstName);
  }

  // Check digits repair single-character OCR confusions (e.g. ZA926446
  // mis-read as IA926446) and tell us which fields are trustworthy.
  // A field is only repaired when another field's check digit verifies —
  // otherwise the mis-read character could be the check digit itself.
  const line2 = corrected[1];
  const { numberCheckOk: numberOk, birthCheckOk: birthOk, expiryCheckOk: expiryOk } =
    structure;

  const numberField =
    numberOk || birthOk || expiryOk
      ? repairWithCheckDigit(
          line2.slice(0, 9),
          line2.slice(9, 10),
          isPlausibleIndianNumberField
        )
      : null;
  const birthField =
    birthOk || numberOk || expiryOk
      ? repairWithCheckDigit(
          line2.slice(13, 19),
          line2.slice(19, 20),
          isPlausibleMrzDate
        )
      : null;
  const expiryField =
    expiryOk || numberOk || birthOk
      ? repairWithCheckDigit(
          line2.slice(21, 27),
          line2.slice(27, 28),
          isPlausibleMrzDate
        )
      : null;

  const passportNumber = (
    numberField ||
    manual.passportNumber ||
    fields.documentNumber ||
    ''
  )
    .replace(/</g, '')
    .trim();

  return {
    valid: Boolean(result?.valid),
    passportNumber,
    passportNumberVerified: Boolean(numberField),
    surname,
    givenNames,
    nationality: 'IND',
    dateOfBirth:
      (birthField && mrzDateToIso(birthField, 'birth')) ||
      manual.dateOfBirth ||
      (fields.birthDate ? mrzDateToIso(String(fields.birthDate), 'birth') : ''),
    sex,
    dateOfExpiry:
      (expiryField && mrzDateToIso(expiryField, 'expiry')) ||
      manual.dateOfExpiry ||
      (fields.expirationDate
        ? mrzDateToIso(String(fields.expirationDate), 'expiry')
        : ''),
    documentType: 'P',
    countryOfIssue: 'IND',
    correctedLines: corrected,
    structure,
    details: result?.details || [],
  };
}

export function parseLooseDateToIso(raw: string): string {
  const cleaned = raw.trim().replace(/,/g, ' ').replace(/\s+/g, ' ');
  const dmy = cleaned.match(
    /^(\d{1,2})[\/\-. ]+([A-Za-z]{3}|\d{1,2})[\/\-. ]+(\d{2,4})$/
  );
  if (!dmy) return '';
  return normalizeLooseDate(dmy[1], dmy[2], dmy[3]) || '';
}

function normalizeLooseDate(
  day: string,
  monthOrName: string,
  yearRaw: string
): string | undefined {
  const months: Record<string, string> = {
    JAN: '01',
    FEB: '02',
    MAR: '03',
    APR: '04',
    MAY: '05',
    JUN: '06',
    JUL: '07',
    AUG: '08',
    SEP: '09',
    OCT: '10',
    NOV: '11',
    DEC: '12',
  };
  const dd = day.padStart(2, '0');
  let mm = monthOrName;
  if (/^[A-Za-z]+$/.test(monthOrName)) {
    mm = months[monthOrName.slice(0, 3).toUpperCase()] || '';
  } else {
    mm = monthOrName.padStart(2, '0');
  }
  if (!mm) return undefined;
  let yyyy = yearRaw;
  if (yyyy.length === 2) {
    const yy = Number(yyyy);
    yyyy = String(yy > 50 ? 1900 + yy : 2000 + yy);
  }
  return `${yyyy}-${mm}-${dd}`;
}

function pickLabeledLine(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const re = new RegExp(
      `${label}[^\\n]{0,80}\\n\\s*([A-Z0-9][^\\n]{1,50})`,
      'i'
    );
    const match = text.match(re);
    if (match?.[1]) {
      const line = match[1].trim();
      if (
        !/SURNAME|GIVEN|DATE|SEX|NATION|PLACE|PASSPORT|INDIA|TYPE|FATHER|MOTHER|ADDRESS|PIN|SEE\b/i.test(
          line
        )
      ) {
        return line;
      }
    }
  }
  return undefined;
}

function pickDateNearLabel(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const re = new RegExp(
      `${label}[^\\n]{0,60}([0-9]{1,2}[\\/\\-.\\s]+(?:[A-Za-z]{3}|[0-9]{1,2})[\\/\\-.\\s]+[0-9]{2,4})`,
      'i'
    );
    const same = text.match(re);
    if (same?.[1]) {
      const iso = parseLooseDateToIso(same[1]);
      if (iso) return iso;
    }
    const multiline = new RegExp(
      `${label}[^\\n]{0,40}\\n\\s*([0-9]{1,2}[\\/\\-.\\s]+(?:[A-Za-z]{3}|[0-9]{1,2})[\\/\\-.\\s]+[0-9]{2,4})`,
      'i'
    );
    const next = text.match(multiline);
    if (next?.[1]) {
      const iso = parseLooseDateToIso(next[1]);
      if (iso) return iso;
    }
  }
  return undefined;
}

export function extractVisualZoneIdentity(ocrTextFull: string): {
  passportNumber?: string;
  surname?: string;
  givenNames?: string;
  dateOfBirth?: string;
  dateOfExpiry?: string;
  dateOfIssue?: string;
  sex?: '' | 'M' | 'F' | 'X';
  placeOfBirth?: string;
  placeOfIssue?: string;
  nationality?: string;
} {
  const text = ocrTextFull.replace(/\r/g, '\n');
  const upper = text.toUpperCase();

  let passportNumber: string | undefined;
  for (const pattern of [
    /PASSPORT\s*NO\.?\s*[:\/]?\s*([A-Z][A-Z0-9]{6,8})/i,
    /PASSPORT\s*NUMBER\s*[:\/]?\s*([A-Z][A-Z0-9]{6,8})/i,
    /\b([A-Z]{2}\d{6,7})\b/,
    /\b([A-Z]\d{7})\b/,
  ]) {
    const match = upper.match(pattern);
    if (match?.[1] && !looksLikeGarbagePassportNumber(match[1])) {
      passportNumber = match[1];
      break;
    }
  }

  const surnameRaw = pickLabeledLine(text, [
    'SURNAME',
    'NOM\\s*/\\s*APELLIDO',
    '\\bNOM\\b',
  ]);
  const givenRaw = pickLabeledLine(text, [
    'GIVEN\\s*NAME\\(?S?\\)?',
    'GIVEN\\s*NAMES?',
    'PR[EÉ]NOMS?',
  ]);

  const surname = surnameRaw
    ? sanitizePersonName(surnameRaw)
    : undefined;
  const givenNames = givenRaw
    ? sanitizePersonName(givenRaw)
    : undefined;

  const dateOfBirth = pickDateNearLabel(text, [
    'DATE OF BIRTH',
    'DATE DE NAISSANCE',
    '\\bDOB\\b',
  ]);
  const dateOfExpiry = pickDateNearLabel(text, [
    'DATE OF EXPIRY',
    'DATE OF EXPIRATION',
    'DATE DE EXPIRATION',
    'VALID\\s*(?:TILL|UNTIL|THRU|UP TO)',
  ]);
  const dateOfIssue = pickDateNearLabel(text, [
    'DATE OF ISSUE',
    'DATE DE DELIVRANCE',
    'ISSUED ON',
    '\\bDOI\\b',
  ]);

  let sex: '' | 'M' | 'F' | 'X' | undefined;
  const sexMatch = text.match(
    /(?:SEX|SEXE|GENDER)\s*[:\/]?\s*([MFX]|MALE|FEMALE)\b/i
  );
  if (sexMatch?.[1]) {
    const raw = sexMatch[1].toUpperCase();
    sex = raw.startsWith('M') ? 'M' : raw.startsWith('F') ? 'F' : 'X';
  } else {
    // Indian layout often has "M" / "F" on its own near Sex label
    const near = text.match(/SEX[^\n]{0,20}\n\s*([MF])\b/i);
    if (near?.[1]) sex = near[1].toUpperCase() as 'M' | 'F';
  }

  const placeOfBirth = pickPlace(text, [
    'PLACE\\s*OF\\s*BIRTH',
    'LIEU\\s*DE\\s*NAISSANCE',
  ]);
  const placeOfIssue = pickPlace(text, [
    'PLACE\\s*OF\\s*ISSUE',
    'LIEU\\s*DE\\s*DELIVRANCE',
  ]);

  const nationality = /\bINDIAN\b/i.test(text)
    ? 'INDIAN'
    : /REPUBLIC\s*OF\s*INDIA/i.test(text)
      ? 'INDIAN'
      : undefined;

  return {
    passportNumber,
    surname:
      surname && !looksLikeGarbageName(surname) ? surname : undefined,
    givenNames:
      givenNames && !looksLikeGarbageName(givenNames) ? givenNames : undefined,
    dateOfBirth,
    dateOfExpiry,
    dateOfIssue,
    sex,
    placeOfBirth,
    placeOfIssue,
    nationality,
  };
}

/** Place values are printed as CITY or CITY,STATE. */
function pickPlace(text: string, labels: string[]): string | undefined {
  const clean = (value: string) => {
    const result = value
      .replace(/[^A-Za-z ,]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ',')
      .trim()
      .toUpperCase();
    if (result.length < 3 || result.length > 40) return undefined;
    if (/SURNAME|GIVEN|DATE|SEX|NATION|PASSPORT|TYPE|CODE|BIRTH|ISSUE/.test(result)) {
      return undefined;
    }
    return result;
  };

  for (const label of labels) {
    const sameLine = text.match(
      new RegExp(`${label}[^\\n]{0,30}?[:\\-]?\\s*([A-Z][A-Z ,]{2,38})`, 'i')
    );
    if (sameLine?.[1]) {
      const value = clean(sameLine[1]);
      if (value) return value;
    }
    const nextLine = text.match(
      new RegExp(`${label}[^\\n]{0,40}\\n\\s*([A-Z][A-Z ,]{2,38})`, 'i')
    );
    if (nextLine?.[1]) {
      const value = clean(nextLine[1]);
      if (value) return value;
    }
  }
  return undefined;
}

export function extractVisualZoneNames(ocrTextFull: string) {
  const id = extractVisualZoneIdentity(ocrTextFull);
  return { surname: id.surname, givenNames: id.givenNames };
}

/** Back page fields plus the issue date, wherever it was printed. */
export function mergeBackPageFields(
  ocrTextFull: string,
  options?: BackPageOptions
): BackPageDetails {
  const text = ocrTextFull.replace(/\r/g, '\n');
  const details = extractBackPageDetails(text, options);

  return {
    ...details,
    dateOfIssue:
      details.dateOfIssue ||
      pickDateNearLabel(text, [
        'DATE OF ISSUE',
        'DATE DE DELIVRANCE',
        'ISSUED ON',
      ]),
  };
}

function frontPageScore(text: string): number {
  const upper = text.toUpperCase();
  const compact = upper.replace(/\s+/g, '');
  let score = 0;
  if (/P<[A-Z]{3}/.test(compact)) score += 6;
  if (/SURNAME/.test(upper)) score += 3;
  if (/GIVENNAME/.test(compact)) score += 3;
  if (/DATEOFEXPIRY/.test(compact)) score += 2;
  if (/PASSPORTNO/.test(compact)) score += 2;
  if (/REPUBLICOFINDIA/.test(compact)) score += 1;
  if (/NATIONALITY/.test(upper)) score += 1;
  return score;
}

function backPageScore(text: string): number {
  const compact = text.toUpperCase().replace(/\s+/g, '');
  let score = 0;
  if (/NAMEOFFATHER/.test(compact)) score += 4;
  if (/NAMEOFMOTHER/.test(compact)) score += 4;
  if (/LEGALGUARDIAN/.test(compact)) score += 2;
  if (/NAMEOFSPOUSE/.test(compact)) score += 2;
  if (/ADDRESS/.test(compact)) score += 2;
  if (/OLDPASSPORT/.test(compact)) score += 2;
  if (/FILENO/.test(compact)) score += 1;
  return score;
}

/**
 * Minimum back-page score to accept a page as the back page. One strong label
 * (father, mother) or a pair of weaker ones clears it; a visa page or a blank
 * sheet does not. Below this we report no back page rather than guessing,
 * because a wrong guess silently fills the parent fields.
 */
const BACK_PAGE_SCORE_FLOOR = 4;

/** Pick which cropped document is the data page and which is the back page. */
export function classifyPages(texts: string[]): { front: number; back: number } {
  if (texts.length === 1) return { front: 0, back: -1 };

  let front = 0;
  let bestFront = -Infinity;
  texts.forEach((text, index) => {
    const score = frontPageScore(text) - backPageScore(text);
    if (score > bestFront) {
      bestFront = score;
      front = index;
    }
  });

  let back = -1;
  let bestBack = BACK_PAGE_SCORE_FLOOR - 1;
  texts.forEach((text, index) => {
    if (index === front) return;
    const score = backPageScore(text);
    if (score > bestBack) {
      bestBack = score;
      back = index;
    }
  });

  return { front, back };
}

/**
 * OCR the MRZ one line at a time.
 * Single-line mode is far more accurate than block mode on low-res scans.
 */
async function readMrzByLineBands(
  front: HTMLCanvasElement,
  ocr: PassportOcr
): Promise<[string, string] | null> {
  const band = detectMrzRegion(front, 0.34);
  const bands = findTextLineBands(band, { minInkRatio: 0.03 });
  const wide = bands.filter((rect) => rect.width > band.width * 0.5);
  const candidates = wide.slice(-2);
  if (candidates.length < 2) return null;

  const texts: string[] = [];
  for (const rect of candidates) {
    if (rect.width < 80 || rect.height < 6) continue;
    const padded = padRect(
      rect,
      Math.round(band.width * 0.01),
      Math.round(rect.height * 0.35),
      band
    );
    const lineCanvas = cropCanvas(band, padded, 2000);
    const { text } = await ocrText(lineCanvas, {
      mrzMode: true,
      ocr,
      psm: Tesseract.PSM.SINGLE_LINE,
    });
    texts.push(text);
  }

  const [a, b] = texts;
  if (!a || !b) return null;
  const aIsFirst = isPassportMrzLine(a) || !isPassportMrzLine(b);
  const first = aIsFirst ? a : b;
  const second = aIsFirst ? b : a;
  if (!isPassportMrzLine(first)) return null;
  return [correctMrzLine1(first), correctMrzLine2(second)];
}

type ParsedMrz = ReturnType<typeof parseAndValidateMrz>;

/**
 * Check digits verified before we stop looking. Three of four means the
 * number, birth date and expiry all independently agree, which in practice
 * only happens on a correct reading.
 */
const MRZ_CONFIDENT_CHECKS = 3;

/** Orientation attempts across the whole upload, to bound scan time. */
const MAX_MRZ_ATTEMPTS = 8;

/** Extra crops read only to locate the back page. */
const MAX_BACK_PAGE_PASSES = 3;

interface MrzSearchResult {
  parsed: ParsedMrz | null;
  score: number;
  sawNonIndian: boolean;
}

/** Best parse among several competing readings of the same MRZ. */
function bestOf(
  candidates: Array<[string, string]>,
  incumbent?: MrzSearchResult
): MrzSearchResult {
  let parsed = incumbent?.parsed ?? null;
  let score = incumbent?.score ?? -1;
  let sawNonIndian = incumbent?.sawNonIndian ?? false;

  for (const candidate of candidates) {
    try {
      const result = parseAndValidateMrz(candidate);
      const candidateScore = scoreMrzResult(result);
      if (candidateScore > score) {
        score = candidateScore;
        parsed = result;
      }
    } catch (error) {
      if (
        error instanceof IndianPassportError &&
        error.message.includes('Only Indian')
      ) {
        sawNonIndian = true;
      }
    }
  }

  return { parsed, score, sawNonIndian };
}

/** Pull an MRZ out of already-OCR'd page text. Last resort for poor scans. */
function findMrzInTexts(texts: string[]): MrzSearchResult {
  const candidates: Array<[string, string]> = [];
  for (const text of texts) {
    const found = findTd3MrzLines(text);
    if (found) candidates.push(found);
  }
  return bestOf(candidates);
}

/** Read the MRZ off one oriented crop using several segmentation modes. */
async function readMrzFromCrop(
  crop: HTMLCanvasElement,
  ocr: PassportOcr
): Promise<{ candidates: Array<[string, string]>; confidence: number }> {
  const candidates: Array<[string, string]> = [];
  let confidence = 0;

  // Per-line beats block mode on low-resolution scans, so it goes first
  const lineBands = await readMrzByLineBands(crop, ocr);
  if (lineBands) candidates.push(lineBands);

  const mrzCanvas = detectMrzRegion(crop);
  for (const psm of [
    Tesseract.PSM.SINGLE_BLOCK,
    Tesseract.PSM.SINGLE_COLUMN,
  ] as const) {
    const pass = await ocrText(mrzCanvas, { mrzMode: true, ocr, psm });
    confidence = Math.max(confidence, pass.confidence);
    const found = findTd3MrzLines(pass.text);
    if (found) candidates.push(found);
  }

  if (!candidates.some((pair) => isPassportMrzLine(pair[0]))) {
    const colorBand = cropMrzBand(crop);
    const pass = await ocrText(colorBand, {
      mrzMode: true,
      ocr,
      psm: Tesseract.PSM.SINGLE_BLOCK,
    });
    confidence = Math.max(confidence, pass.confidence);
    const found = findTd3MrzLines(pass.text);
    if (found) candidates.push(found);
  }

  // A4 scans and phone photos often leave the MRZ mid-frame, not at the
  // bottom. If the geometric band missed, try the lower-middle of the page.
  if (!candidates.some((pair) => isPassportMrzLine(pair[0]))) {
    const { width, height } = sourceSize(crop);
    const fallbacks = [
      {
        x: 0,
        y: Math.floor(height * 0.52),
        width,
        height: Math.floor(height * 0.38),
      },
      {
        x: 0,
        y: Math.floor(height * 0.32),
        width,
        height: Math.floor(height * 0.4),
      },
    ];
    for (const rect of fallbacks) {
      if (rect.height < 24) continue;
      const band = binarizeCanvas(
        cropCanvas(crop, rect, Math.min(2600, Math.max(rect.width * 2, 2000)))
      );
      const pass = await ocrText(band, {
        mrzMode: true,
        ocr,
        psm: Tesseract.PSM.SINGLE_BLOCK,
      });
      confidence = Math.max(confidence, pass.confidence);
      const found = findTd3MrzLines(pass.text);
      if (found && isPassportMrzLine(found[0])) {
        candidates.push(found);
        break;
      }
    }
  }

  return {
    candidates: candidates.filter((pair) => isPassportMrzLine(pair[0])),
    confidence,
  };
}

/** Rotate a candidate to an absolute orientation, allowing for the one already applied. */
function reorient(
  candidate: CandidatePage,
  target: Rotation
): HTMLCanvasElement {
  const delta = ((((target - candidate.rotation) % 360) + 360) % 360) as Rotation;
  return delta === 0 ? candidate.canvas : rotateCanvas(candidate.canvas, delta);
}

/**
 * Identify the data page and its orientation together.
 *
 * Attempts are ordered by each crop's best-guess orientation first, then by
 * the 180° flip, because a well-ranked crop at its predicted orientation is
 * far more likely than a poorly-ranked one. The search stops as soon as
 * enough check digits verify, so a clean upload costs a single pass.
 */
async function findDataPage(
  pageCandidates: CandidatePage[],
  ocr: PassportOcr
): Promise<{
  page: CandidatePage | null;
  parsed: ParsedMrz | null;
  confidence: number;
  sawNonIndian: boolean;
}> {
  // Embedded text is free and often already holds a valid TD3 (scanner OCR).
  const fromText = findMrzInTexts(pageCandidates.map((c) => c.textLayer));
  if (
    fromText.parsed &&
    fromText.parsed.structure.checksPassed >= MRZ_CONFIDENT_CHECKS
  ) {
    const withMrz = pageCandidates.filter((candidate) =>
      findTd3MrzLines(candidate.textLayer)
    );
    const page =
      [...withMrz].sort((a, b) => b.bandScore - a.bandScore)[0] ??
      pageCandidates[0] ??
      null;
    return {
      page,
      parsed: fromText.parsed,
      confidence: 90,
      sawNonIndian: fromText.sawNonIndian,
    };
  }

  const attempts: Array<{ candidate: CandidatePage; rotation: Rotation }> = [];
  for (const rank of [0, 1, 2]) {
    for (const candidate of pageCandidates) {
      const rotations: Rotation[] = [
        candidate.rotation,
        ...candidate.fallbackRotations,
      ];
      const rotation = rotations[rank];
      if (rotation !== undefined) attempts.push({ candidate, rotation });
    }
  }

  let best: MrzSearchResult = fromText;
  let bestPage: CandidatePage | null = fromText.parsed
    ? [...pageCandidates]
        .filter((candidate) => findTd3MrzLines(candidate.textLayer))
        .sort((a, b) => b.bandScore - a.bandScore)[0] ?? pageCandidates[0]
    : null;
  let confidence = fromText.parsed ? 70 : 0;

  for (const { candidate, rotation } of attempts.slice(0, MAX_MRZ_ATTEMPTS)) {
    const canvas = reorient(candidate, rotation);
    const { candidates, confidence: passConfidence } = await readMrzFromCrop(
      canvas,
      ocr
    );
    confidence = Math.max(confidence, passConfidence);

    const previousScore = best.score;
    best = bestOf(candidates, best);
    if (best.score > previousScore) {
      bestPage = { ...candidate, canvas, rotation };
    }

    if (
      best.parsed &&
      best.parsed.structure.checksPassed >= MRZ_CONFIDENT_CHECKS
    ) {
      break;
    }
  }

  return {
    page: bestPage,
    parsed: best.parsed,
    confidence,
    sawNonIndian: best.sawNonIndian,
  };
}

/**
 * Rank MRZ readings so the most complete one wins.
 *
 * Check digits carry the most weight: they are the only evidence that is
 * independent of how plausible the text happens to look.
 */
export function scoreMrzResult(parsed: ParsedMrz): number {
  if (
    looksLikeGarbagePassportNumber(parsed.passportNumber) &&
    parsed.structure.checksPassed < 2
  ) {
    return -1;
  }
  if (!isPassportMrzLine(parsed.correctedLines[0])) return -1;

  let score = 0;
  if (parsed.valid) score += 10;
  score += parsed.structure.checksPassed * 6;
  if (parsed.structure.hasTd3Layout) score += 4;
  if (parsed.passportNumberVerified) score += 5;
  if (!looksLikeGarbagePassportNumber(parsed.passportNumber)) score += 4;
  if (!looksLikeGarbageName(parsed.surname)) score += 3;
  if (!looksLikeGarbageName(parsed.givenNames)) score += 3;
  if (isIsoDate(parsed.dateOfBirth)) score += 4;
  if (isIsoDate(parsed.dateOfExpiry)) score += 3;
  if (parsed.sex) score += 2;
  return score;
}

/** All dd/mm/yyyy dates on the data page, in reading order. */
export function collectDates(text: string): string[] {
  const matches = text.match(
    /\b\d{1,2}[\/\-. ]{1,2}(?:[A-Za-z]{3}|\d{1,2})[\/\-. ]{1,2}\d{2,4}\b/g
  );
  if (!matches) return [];
  const seen = new Set<string>();
  const dates: string[] = [];
  for (const raw of matches) {
    const iso = parseLooseDateToIso(raw.replace(/\s+/g, ' ').trim());
    if (iso && !seen.has(iso)) {
      seen.add(iso);
      dates.push(iso);
    }
  }
  return dates;
}

/** Indian passport validity: 10 years for adults, 5 for minors. */
const VALIDITY_YEARS = [10, 5] as const;

function shiftIsoDate(iso: string, years: number, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y + years, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function yearsBetween(fromIso: string, toIso: string): number {
  return (
    (Date.parse(toIso) - Date.parse(fromIso)) / (365.2425 * 24 * 60 * 60 * 1000)
  );
}

/**
 * Issue date implied by an expiry date. Indian passports expire exactly one
 * day short of the validity anniversary (issued 05/03/2024 → 04/03/2034), so
 * this is exact rather than approximate.
 */
export function issueDateFromExpiry(expiryIso: string, validityYears = 10): string {
  return shiftIsoDate(expiryIso, -validityYears, 1);
}

function isPlausibleBirthDate(iso: string, todayIso: string): boolean {
  const age = yearsBetween(iso, todayIso);
  return age >= 0 && age <= 120;
}

function isPlausibleExpiryDate(iso: string, todayIso: string): boolean {
  const delta = yearsBetween(todayIso, iso);
  return delta >= -15 && delta <= 11;
}

/**
 * Recover birth/issue/expiry from an unlabelled set of dates.
 *
 * A scanned sheet often carries dates that belong to nothing on the data page
 * — a notary stamp, an old passport's issue date, a visa validity — so this
 * only accepts dates that fit the passport's own arithmetic. Anchors are
 * fields already read from the MRZ and are never overridden.
 */
export function inferDates(
  dates: string[],
  anchors?: { dateOfBirth?: string; dateOfExpiry?: string; todayIso?: string }
): {
  dateOfBirth?: string;
  dateOfIssue?: string;
  dateOfExpiry?: string;
} {
  const todayIso = anchors?.todayIso || new Date().toISOString().slice(0, 10);
  const candidates = [...new Set(dates.filter(isIsoDate))].sort();

  const dateOfExpiry =
    (anchors?.dateOfExpiry && isIsoDate(anchors.dateOfExpiry)
      ? anchors.dateOfExpiry
      : undefined) ||
    [...candidates]
      .reverse()
      .find((iso) => isPlausibleExpiryDate(iso, todayIso));

  const dateOfBirth =
    (anchors?.dateOfBirth && isIsoDate(anchors.dateOfBirth)
      ? anchors.dateOfBirth
      : undefined) ||
    candidates.find(
      (iso) =>
        isPlausibleBirthDate(iso, todayIso) &&
        (!dateOfExpiry || iso < dateOfExpiry)
    );

  let dateOfIssue: string | undefined;
  if (dateOfExpiry) {
    // Prefer a date actually printed on the page that matches the arithmetic
    for (const years of VALIDITY_YEARS) {
      const derived = issueDateFromExpiry(dateOfExpiry, years);
      if (candidates.includes(derived)) {
        dateOfIssue = derived;
        break;
      }
    }
    if (!dateOfIssue) {
      // No printed match — derive it, choosing validity by age at issue
      const tenYear = issueDateFromExpiry(dateOfExpiry, 10);
      const wasMinor =
        dateOfBirth !== undefined && yearsBetween(dateOfBirth, tenYear) < 18;
      dateOfIssue = wasMinor
        ? issueDateFromExpiry(dateOfExpiry, 5)
        : tenYear;
    }
  }

  return { dateOfBirth, dateOfIssue, dateOfExpiry };
}

/**
 * Back page lists father, mother, spouse and address in fixed order.
 * Used when bilingual labels are too noisy for the label regexes.
 *
 * Order alone is not evidence, so this refuses to guess on data-page text and
 * skips any candidate built only from the holder's own name tokens.
 */
export function extractParentsPositional(
  backText: string,
  options?: { holderNames?: string[] }
): {
  fathersName?: string;
  mothersName?: string;
} {
  if (looksLikeFrontPage(backText) || !hasBackPageEvidence(backText)) {
    return {};
  }

  const holderFull = sanitizePersonName((options?.holderNames || []).join(' '));
  const holderGiven = sanitizePersonName(options?.holderNames?.[1] || '');

  const lines = backText
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const stop =
    /FATHER|MOTHER|SPOUSE|GUARDIAN|ADDRESS|NAME|INDIA|PIN|FILE|PASSPORT|FLAT|ROAD|STREET|NAGAR|DISTRICT|STATE|FORM|OLD|OBSERVATION/i;

  const names: string[] = [];
  for (const line of lines) {
    const cleaned = line.replace(/[^A-Za-z .']/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned || cleaned.length < 4 || cleaned.length > 40) continue;
    if (stop.test(cleaned)) continue;
    if (cleaned !== cleaned.toUpperCase()) continue;
    const words = cleaned.split(' ');
    if (words.length > 4) continue;
    if (holderFull && cleaned === holderFull) continue;
    if (holderGiven && cleaned === holderGiven) continue;
    names.push(cleaned);
    if (names.length === 2) break;
  }

  return { fathersName: names[0], mothersName: names[1] };
}

function isNameCompletion(mrz: string, visual: string): boolean {
  const mrzTokens = mrz.split(/\s+/).filter(Boolean);
  const visualTokens = visual.split(/\s+/).filter(Boolean);
  if (!mrzTokens.length || visualTokens.length < mrzTokens.length) return false;
  if (visualTokens.length > mrzTokens.length) return false;
  return mrzTokens.every((token, index) => {
    const other = visualTokens[index];
    if (index < mrzTokens.length - 1) return other === token;
    return other.startsWith(token) && other.length > token.length && other.length - token.length <= 12;
  });
}

function pickBestName(mrzValue?: string, visualValue?: string): string {
  const mrzOk = mrzValue && !looksLikeGarbageName(mrzValue);
  const visualOk = visualValue && !looksLikeGarbageName(visualValue);
  if (mrzOk && visualOk) {
    if (isNameCompletion(mrzValue, visualValue)) return visualValue;
    return mrzValue;
  }
  if (mrzOk) return mrzValue;
  if (visualOk) return visualValue;
  return mrzValue || visualValue || '';
}

function pickBest(
  mrzValue: string | undefined,
  visualValue: string | undefined,
  isBad: (v: string) => boolean
): string {
  const mrzOk = mrzValue && !isBad(mrzValue);
  const visualOk = visualValue && !isBad(visualValue);
  if (mrzOk) return mrzValue!;
  if (visualOk) return visualValue!;
  return mrzValue || visualValue || '';
}

function recoverIndianPassportNumber(
  mrz?: string,
  visual?: string,
  verified?: boolean
): string {
  // OCR often prefixes a 1-letter Indian number with I or T (T1131439 → IT1131439).
  if (
    mrz &&
    visual &&
    /^[A-Z]\d{7}$/.test(visual) &&
    mrz.length === visual.length + 1 &&
    mrz.endsWith(visual)
  ) {
    return visual;
  }
  if (verified && mrz && !looksLikeGarbagePassportNumber(mrz)) return mrz;
  return pickBest(mrz, visual, looksLikeGarbagePassportNumber);
}

function pickBestDate(mrzValue?: string, visualValue?: string): string {
  if (mrzValue && isIsoDate(mrzValue)) return mrzValue;
  if (visualValue && isIsoDate(visualValue)) return visualValue;
  return mrzValue || visualValue || '';
}

/** OCR a likely-back crop, trying the next rotation if the first has no labels. */
async function readBackPageText(
  candidate: CandidatePage,
  ocr: PassportOcr
): Promise<{ text: string; canvas: HTMLCanvasElement; confidence: number }> {
  const rotations: Rotation[] = [
    candidate.rotation,
    ...candidate.fallbackRotations,
  ].slice(0, 2);

  let best = {
    text: '',
    canvas: candidate.canvas,
    confidence: 0,
    score: -1,
  };

  for (const rotation of rotations) {
    const canvas = reorient(candidate, rotation);
    const pass = await ocrText(canvas, { mrzMode: false, ocr });
    const score = backPageScore(pass.text);
    if (score > best.score) {
      best = {
        text: pass.text,
        canvas,
        confidence: pass.confidence,
        score,
      };
    }
    if (score >= BACK_PAGE_SCORE_FLOOR) break;
  }

  return best;
}

async function readPrintedZone(
  canvas: HTMLCanvasElement,
  ocr: PassportOcr
): Promise<{ text: string; confidence: number }> {
  const first = await ocrText(canvas, { mrzMode: false, ocr });
  if (first.text.replace(/\s+/g, '').length > 50) return first;

  const { width, height } = sourceSize(canvas);
  const inset = cropCanvas(canvas, {
    x: Math.floor(width * 0.06),
    y: Math.floor(height * 0.06),
    width: Math.floor(width * 0.88),
    height: Math.floor(height * 0.74),
  });
  const retry = await ocrText(inset, {
    mrzMode: false,
    ocr,
    psm: Tesseract.PSM.SPARSE_TEXT,
  });
  return retry.text.replace(/\s+/g, '').length > first.text.replace(/\s+/g, '').length
    ? retry
    : first;
}

/**
 * Advanced Indian passport extraction.
 *
 * 1. Rasterize input and crop the passport out of the scanned sheet
 * 2. Classify which crop is the data page and which is the back page
 * 3. Read the MRZ line-by-line, plus block/sparse passes, and keep the best
 * 4. Fill remaining fields from the printed zone and back page
 */
export async function extractIndianPassport(
  input: File | Blob | HTMLCanvasElement
): Promise<IndianPassportExtraction> {
  const warnings: string[] = [];
  const pageCandidates = await selectCandidatePages(input);
  if (!pageCandidates.length) {
    throw new IndianPassportError('Could not read this passport file');
  }

  const ocr = await createPassportOcr();

  try {
    // Find the data page by reading an MRZ off it, not by its position in the
    // file. Orientation is settled the same way: the crop and quarter turn
    // that yield a check-digit-valid TD3 are, by definition, the right ones.
    const search = await findDataPage(pageCandidates, ocr);
    let parsed = search.parsed;
    const front = search.page?.canvas ?? pageCandidates[0].canvas;
    const mrzConfidence = search.confidence;
    const sourcePageCount =
      search.page?.sourcePageCount ?? pageCandidates[0].sourcePageCount ?? 1;
    const dataPageNumber = search.page?.pageNumber ?? 1;

    const frontPass = await readPrintedZone(front, ocr);
    const frontText = [frontPass.text, search.page?.textLayer]
      .filter(Boolean)
      .join('\n');
    let bestVisualConfidence = frontPass.confidence;

    const otherPages = rankBackPageCandidates(
      pageCandidates.filter((candidate) => candidate.id !== search.page?.id),
      dataPageNumber,
      sourcePageCount
    );

    const otherReads: Array<{
      candidate: CandidatePage;
      text: string;
      canvas: HTMLCanvasElement;
    }> = [];
    for (const candidate of otherPages.slice(0, MAX_BACK_PAGE_PASSES)) {
      const pass = await readBackPageText(candidate, ocr);
      otherReads.push({
        candidate: { ...candidate, canvas: pass.canvas },
        text: pass.text,
        canvas: pass.canvas,
      });
      bestVisualConfidence = Math.max(bestVisualConfidence, pass.confidence);
    }

    const otherTexts = otherReads.map((read) => read.text);

    // The MRZ may still have failed on a very poor scan; fall back to reading
    // the printed labels. Do not feed visa-page text in as if it were a second
    // data page — findMrzInTexts already rejects non-passport lines.
    let retrySawNonIndian = false;
    if (!parsed) {
      const retry = findMrzInTexts([
        frontText,
        ...pageCandidates.map((candidate) => candidate.textLayer),
        ...otherTexts,
      ]);
      parsed = retry.parsed;
      retrySawNonIndian = retry.sawNonIndian;
    }

    // Back page: only a crop that scores as one, never a positional guess
    const { back: backOffset } = classifyPages([frontText, ...otherTexts]);
    const separateBack = backOffset > 0;
    const backRead = separateBack ? otherReads[backOffset - 1] : undefined;
    const backText = separateBack
      ? otherTexts[backOffset - 1]
      : hasBackPageEvidence(frontText)
        ? frontText
        : '';

    const frontPreviewUrl = URL.createObjectURL(await canvasToBlob(front));
    const backPreviewUrl = backRead
      ? URL.createObjectURL(await canvasToBlob(backRead.canvas))
      : undefined;

    const visual = extractVisualZoneIdentity(frontText);

    // Indian-only gate: MRZ must say IND, or the print must say so.
    // When OCR cannot confirm India (common on soft/skewed scans), open an
    // empty form so the traveller can enter details manually instead of
    // blocking on "Only Indian passports are supported".
    const indiaSignal =
      /\bINDIAN\b/i.test(frontText) ||
      /REPUBLIC\s*OF\s*INDIA/i.test(frontText) ||
      frontText.toUpperCase().includes('IND');
    const cannotConfirmIndia =
      ((search.sawNonIndian || retrySawNonIndian) && !parsed) ||
      (!parsed && !indiaSignal);
    if (cannotConfirmIndia) {
      if (frontText.replace(/\s+/g, '').length < 20) {
        throw new IndianPassportError(
          'Could not read passport details. Use a clearer scan of the data page.'
        );
      }
      warnings.push(
        'We could not auto-fill from this scan. Please enter your details manually.'
      );
      return {
        passportNumber: '',
        surname: '',
        givenNames: '',
        nationality: 'INDIAN',
        dateOfBirth: '',
        sex: '',
        dateOfExpiry: '',
        documentType: 'P',
        countryOfIssue: 'IND',
        frontPreviewUrl,
        backPreviewUrl,
        rawMrz: ['', ''],
        confidence: Math.max(mrzConfidence, bestVisualConfidence),
        warnings,
      };
    }

    // Names: MRZ is structured, but it truncates; the printed zone keeps the rest.
    const surname = pickBestName(parsed?.surname, visual.surname);
    const givenNames = pickBestName(parsed?.givenNames, visual.givenNames);
    // A check-digit-verified number beats anything OCR read off the print
    const passportNumber = recoverIndianPassportNumber(
      parsed?.passportNumber,
      visual.passportNumber,
      parsed?.passportNumberVerified
    );

    // Back page needs the current number so it is not read as the old one,
    // and the holder's name so the data page cannot pose as a parent.
    const holderNames = [surname, givenNames].filter(Boolean);
    const sameSheetBack = !separateBack && Boolean(backText);
    const backDetails: BackPageDetails = backText
      ? mergeBackPageFields(backText, {
          currentPassportNumber: passportNumber,
          holderNames,
          allowPositionalNames: separateBack || sameSheetBack,
        })
      : {};

    let dateOfBirth = pickBestDate(parsed?.dateOfBirth, visual.dateOfBirth);
    let dateOfExpiry = pickBestDate(parsed?.dateOfExpiry, visual.dateOfExpiry);
    let dateOfIssue = visual.dateOfIssue || backDetails.dateOfIssue || '';

    if (!dateOfBirth || !dateOfExpiry || !dateOfIssue) {
      // Anchored on whatever the MRZ already proved, and read only from the
      // data page so a notary stamp or old-passport date cannot win.
      const inferred = inferDates(collectDates(frontText), {
        dateOfBirth,
        dateOfExpiry,
      });
      if (!dateOfBirth && inferred.dateOfBirth) dateOfBirth = inferred.dateOfBirth;
      if (!dateOfExpiry && inferred.dateOfExpiry) {
        dateOfExpiry = inferred.dateOfExpiry;
      }
      if (!dateOfIssue && inferred.dateOfIssue) dateOfIssue = inferred.dateOfIssue;
    }

    const sex = (parsed?.sex || visual.sex || '') as '' | 'M' | 'F' | 'X';

    let fathersName = backDetails.fathersName;
    let mothersName = backDetails.mothersName;
    if ((separateBack || sameSheetBack) && (!fathersName || !mothersName)) {
      const positional = extractParentsPositional(backText, { holderNames });
      fathersName = fathersName || positional.fathersName;
      mothersName = mothersName || positional.mothersName;
    }

    if (!passportNumber && !surname) {
      throw new IndianPassportError(
        'Could not read passport details. Use a clearer scan of the data page.'
      );
    }

    const missing: string[] = [];
    if (!givenNames) missing.push('first name');
    if (!dateOfBirth) missing.push('date of birth');
    if (!sex) missing.push('gender');
    if (!dateOfExpiry) missing.push('expiry date');
    if (missing.length) {
      warnings.push(`Please confirm ${missing.join(', ')} — not fully readable`);
    }

    return {
      passportNumber: passportNumber.toUpperCase(),
      surname: surname.toUpperCase(),
      givenNames: givenNames.toUpperCase(),
      nationality: visual.nationality || 'INDIAN',
      dateOfBirth,
      sex,
      dateOfExpiry,
      documentType: 'P',
      countryOfIssue: 'IND',
      fathersName,
      mothersName,
      spouseName: backDetails.spouseName,
      dateOfIssue: dateOfIssue || undefined,
      placeOfBirth: visual.placeOfBirth,
      placeOfIssue: visual.placeOfIssue,
      address: backDetails.address,
      fileNumber: backDetails.fileNumber,
      oldPassportNumber: backDetails.oldPassportNumber,
      oldPassportDateOfIssue: backDetails.oldPassportDateOfIssue,
      oldPassportPlaceOfIssue: backDetails.oldPassportPlaceOfIssue,
      frontPreviewUrl,
      backPreviewUrl,
      rawMrz: parsed?.correctedLines || ['', ''],
      confidence: Math.max(mrzConfidence, bestVisualConfidence),
      warnings,
    };
  } finally {
    await ocr.terminate();
  }
}
