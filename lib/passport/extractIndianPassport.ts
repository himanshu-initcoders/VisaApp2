import { parse as parseMrz } from 'mrz';
import Tesseract from 'tesseract.js';
import type { IndianPassportExtraction } from './types';
import {
  canvasToBlob,
  isPdfFile,
  pdfPagesToCanvases,
} from './pdfToImage';
import { normalizeDocumentPages } from './documentRegion';
import { extractBackPageDetails, type BackPageDetails } from './backPage';
import {
  binarizeCanvas,
  cropCanvas,
  findTextLineBands,
  padRect,
  sourceSize,
} from './imageOps';

const MRZ_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
const TD3_LEN = 44;

export class IndianPassportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IndianPassportError';
  }
}

/** Crop and binarize the MRZ band at the bottom of a passport data page. */
export function detectMrzRegion(
  source: HTMLCanvasElement | HTMLImageElement,
  bottomRatio = 0.28
): HTMLCanvasElement {
  const { width, height } = sourceSize(source);
  const cropHeight = Math.max(48, Math.floor(height * bottomRatio));
  const band = cropCanvas(
    source,
    { x: 0, y: height - cropHeight, width, height: cropHeight },
    Math.min(2600, Math.max(width * 2, 1800))
  );
  return binarizeCanvas(band);
}

export async function ocrText(
  image: HTMLCanvasElement | HTMLImageElement | Blob | File,
  options?: {
    mrzMode?: boolean;
    psm?: typeof Tesseract.PSM[keyof typeof Tesseract.PSM];
    worker?: Tesseract.Worker;
  }
): Promise<{ text: string; confidence: number }> {
  const ownsWorker = !options?.worker;
  const worker =
    options?.worker ||
    (await Tesseract.createWorker('eng', undefined, {
      logger: () => undefined,
    }));

  try {
    if (options?.mrzMode) {
      await worker.setParameters({
        tessedit_char_whitelist: MRZ_WHITELIST,
        tessedit_pageseg_mode: options.psm ?? Tesseract.PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '0',
      });
    } else {
      await worker.setParameters({
        tessedit_char_whitelist: '',
        tessedit_pageseg_mode: options?.psm ?? Tesseract.PSM.AUTO,
      });
    }
    const result = await worker.recognize(image);
    return {
      text: result.data.text || '',
      confidence: result.data.confidence ?? 0,
    };
  } finally {
    if (ownsWorker) await worker.terminate();
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
export function correctMrzLine1(line: string): string {
  let s = normalizeMrz(line);
  if (s.startsWith('PIND')) s = `P<${s.slice(1)}`;
  if (!s.startsWith('P<')) s = `P<${s.replace(/^P/, '')}`;

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

  // Real TD3 name separator is << with no junk < inside surname
  const sepAt = rest.indexOf('<<');
  if (sepAt >= 0) {
    const surnamePart = rest.slice(0, sepAt);
    const givenPart = rest.slice(sepAt + 2);
    // Clean MRZ: surname has no single-< OCR junk
    if (!surnamePart.includes('<')) {
      const surname = surnamePart.replace(/[^A-Z]/g, '');
      const given = givenPart
        .split('<')
        .map((t) => t.replace(/[^A-Z]/g, ''))
        .filter((t) => t.length >= 2)
        .join('<');
      if (surname) return pad44(`P<${country}${surname}<<${given}`);
    }
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

  const line1 = rawLines.find((l) => l.includes('P<') || l.startsWith('P'));
  const line2 = rawLines.find(
    (l) => /[A-Z]{0,2}\d{6,}/.test(l) && (l.includes('IND') || /[MFX]/.test(l))
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
  const surname = surRaw.replace(/</g, '').replace(/[^A-Z]/g, '');
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
    .trim();
}

function looksLikeGarbageName(value: string): boolean {
  if (!value) return true;
  if (value.length === 1) return true;
  if (value.length > 30) return true;
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
  const corrected: [string, string] = [
    correctMrzLine1(lines[0]),
    correctMrzLine2(lines[1]),
  ];
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
  const numberOk = mrzCheckDigit(line2.slice(0, 9)) === line2.slice(9, 10);
  const birthOk = mrzCheckDigit(line2.slice(13, 19)) === line2.slice(19, 20);
  const expiryOk = mrzCheckDigit(line2.slice(21, 27)) === line2.slice(27, 28);

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
  options?: { currentPassportNumber?: string }
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

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

function imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new IndianPassportError('Canvas unavailable');
  ctx.drawImage(img, 0, 0);
  return canvas;
}

/**
 * Rasterize input and crop the actual passport out of each sheet.
 * Scanned PDFs put a small passport on a big white page — OCR needs the crop.
 */
async function inputToDocumentPages(
  input: File | Blob | HTMLCanvasElement
): Promise<HTMLCanvasElement[]> {
  const rawPages: HTMLCanvasElement[] = [];

  if (input instanceof HTMLCanvasElement) {
    rawPages.push(input);
  } else {
    const header = new Uint8Array(await input.slice(0, 5).arrayBuffer());
    const isPdf =
      isPdfFile(input) ||
      (header[0] === 0x25 &&
        header[1] === 0x50 &&
        header[2] === 0x44 &&
        header[3] === 0x46);

    if (isPdf) {
      const pages = await pdfPagesToCanvases(input, 3);
      if (!pages.length) {
        throw new IndianPassportError('Could not read PDF pages');
      }
      rawPages.push(...pages);
    } else {
      rawPages.push(imageToCanvas(await loadImage(input)));
    }
  }

    const documents: HTMLCanvasElement[] = [];
  for (const page of rawPages) {
    documents.push(...normalizeDocumentPages(page, { maxRegions: 3 }));
  }
  return documents.slice(0, 4);
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

/** Pick which cropped document is the data page and which is the back page. */
function classifyPages(texts: string[]): { front: number; back: number } {
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
  let bestBack = 0;
  texts.forEach((text, index) => {
    if (index === front) return;
    const score = backPageScore(text);
    if (score > bestBack) {
      bestBack = score;
      back = index;
    }
  });

  if (back === -1) back = front === 0 ? 1 : 0;
  return { front, back };
}

/**
 * OCR the MRZ one line at a time.
 * Single-line mode is far more accurate than block mode on low-res scans.
 */
async function readMrzByLineBands(
  front: HTMLCanvasElement,
  worker: Tesseract.Worker
): Promise<[string, string] | null> {
  const band = detectMrzRegion(front, 0.34);
  const bands = findTextLineBands(band, { minInkRatio: 0.03 });
  const wide = bands.filter((rect) => rect.width > band.width * 0.5);
  const candidates = wide.slice(-2);
  if (candidates.length < 2) return null;

  const texts: string[] = [];
  for (const rect of candidates) {
    const padded = padRect(
      rect,
      Math.round(band.width * 0.01),
      Math.round(rect.height * 0.35),
      band
    );
    const lineCanvas = cropCanvas(band, padded, 2000);
    const { text } = await ocrText(lineCanvas, {
      mrzMode: true,
      worker,
      psm: Tesseract.PSM.SINGLE_LINE,
    });
    texts.push(text);
  }

  const [a, b] = texts;
  const aIsFirst = normalizeMrz(a).includes('P<') || !normalizeMrz(b).includes('P<');
  const first = aIsFirst ? a : b;
  const second = aIsFirst ? b : a;
  return [correctMrzLine1(first), correctMrzLine2(second)];
}

type ParsedMrz = ReturnType<typeof parseAndValidateMrz>;

/** Rank MRZ readings so the most complete one wins. */
function scoreMrzResult(parsed: ParsedMrz): number {
  let score = 0;
  if (parsed.valid) score += 10;
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

/**
 * Indian passports are issued for 10 years, so birth/issue/expiry can be
 * inferred from an unlabeled set of dates when OCR loses the labels.
 */
export function inferDates(dates: string[]): {
  dateOfBirth?: string;
  dateOfIssue?: string;
  dateOfExpiry?: string;
} {
  if (dates.length < 2) return {};
  const sorted = [...dates].sort();
  const dateOfBirth = sorted[0];
  const dateOfExpiry = sorted[sorted.length - 1];

  let dateOfIssue: string | undefined;
  const expiryYear = Number(dateOfExpiry.slice(0, 4));
  for (const candidate of sorted) {
    if (candidate === dateOfBirth || candidate === dateOfExpiry) continue;
    const year = Number(candidate.slice(0, 4));
    if (expiryYear - year === 10) {
      dateOfIssue = candidate;
      break;
    }
  }
  if (!dateOfIssue && sorted.length >= 3) dateOfIssue = sorted[1];

  return { dateOfBirth, dateOfIssue, dateOfExpiry };
}

/**
 * Back page lists father, mother, spouse and address in fixed order.
 * Used when bilingual labels are too noisy for the label regexes.
 */
export function extractParentsPositional(backText: string): {
  fathersName?: string;
  mothersName?: string;
} {
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
    names.push(cleaned);
    if (names.length === 2) break;
  }

  return { fathersName: names[0], mothersName: names[1] };
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

function pickBestDate(mrzValue?: string, visualValue?: string): string {
  if (mrzValue && isIsoDate(mrzValue)) return mrzValue;
  if (visualValue && isIsoDate(visualValue)) return visualValue;
  return mrzValue || visualValue || '';
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
  const pages = await inputToDocumentPages(input);
  if (!pages.length) {
    throw new IndianPassportError('Could not read this passport file');
  }

  const worker = await Tesseract.createWorker('eng', undefined, {
    logger: () => undefined,
  });

  try {
    const pageTexts: string[] = [];
    let bestVisualConfidence = 0;
    for (const page of pages) {
      const result = await ocrText(page, { mrzMode: false, worker });
      pageTexts.push(result.text);
      bestVisualConfidence = Math.max(bestVisualConfidence, result.confidence);
    }

    const { front: frontIndex, back: backIndex } = classifyPages(pageTexts);
    const front = pages[frontIndex];
    const back = backIndex >= 0 ? pages[backIndex] : undefined;
    const frontText = pageTexts[frontIndex];
    // Everything OCR'd, so a single image holding both pages still yields
    // back-page fields even when no separate back crop was detected.
    const corpus = pageTexts.join('\n');
    const backText = backIndex >= 0 ? pageTexts[backIndex] : corpus;
    const combined = corpus;

    const frontPreviewUrl = URL.createObjectURL(await canvasToBlob(front));
    const backPreviewUrl = back
      ? URL.createObjectURL(await canvasToBlob(back))
      : undefined;

    const visual = extractVisualZoneIdentity(combined);

    // Sequential OCR on the shared worker (parallel recognize races setParameters)
    const candidates: Array<[string, string]> = [];

    const lineBands = await readMrzByLineBands(front, worker);
    if (lineBands) candidates.push(lineBands);

    const mrzCanvas = detectMrzRegion(front, 0.3);
    const mrzBlock = await ocrText(mrzCanvas, {
      mrzMode: true,
      worker,
      psm: Tesseract.PSM.SINGLE_BLOCK,
    });
    const mrzColumn = await ocrText(mrzCanvas, {
      mrzMode: true,
      worker,
      psm: Tesseract.PSM.SINGLE_COLUMN,
    });
    const sparse = await ocrText(front, {
      mrzMode: true,
      worker,
      psm: Tesseract.PSM.SPARSE_TEXT,
    });

    for (const blob of [
      mrzBlock.text,
      mrzColumn.text,
      sparse.text,
      frontText,
      combined,
    ]) {
      const found = findTd3MrzLines(blob);
      if (found) candidates.push(found);
    }

    let parsed: ParsedMrz | null = null;
    let bestScore = -1;
    let sawNonIndian = false;

    for (const candidate of candidates) {
      try {
        const result = parseAndValidateMrz(candidate);
        const score = scoreMrzResult(result);
        if (score > bestScore) {
          bestScore = score;
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

    // Indian-only gate: MRZ must say IND, or the print must say so
    const indiaSignal =
      /\bINDIAN\b/i.test(combined) ||
      /REPUBLIC\s*OF\s*INDIA/i.test(combined) ||
      combined.toUpperCase().includes('IND');
    if (sawNonIndian && !parsed) {
      throw new IndianPassportError('Only Indian passports are supported');
    }
    if (!parsed && !indiaSignal) {
      throw new IndianPassportError(
        'Only Indian passports are supported. We could not confirm this is an Indian passport.'
      );
    }

    // Keep good MRZ fields even when check digits fail; visual only fills gaps.
    const surname = pickBest(
      parsed?.surname,
      visual.surname,
      looksLikeGarbageName
    );
    const givenNames = pickBest(
      parsed?.givenNames,
      visual.givenNames,
      looksLikeGarbageName
    );
    // A check-digit-verified number beats anything OCR read off the print
    const passportNumber = parsed?.passportNumberVerified
      ? parsed.passportNumber
      : pickBest(
          parsed?.passportNumber,
          visual.passportNumber,
          looksLikeGarbagePassportNumber
        );

    // Back page needs the current number so it is not read as the old one
    const backDetails = mergeBackPageFields(backText, {
      currentPassportNumber: passportNumber,
    });

    let dateOfBirth = pickBestDate(parsed?.dateOfBirth, visual.dateOfBirth);
    let dateOfExpiry = pickBestDate(parsed?.dateOfExpiry, visual.dateOfExpiry);
    let dateOfIssue = visual.dateOfIssue || backDetails.dateOfIssue || '';

    if (!dateOfBirth || !dateOfExpiry || !dateOfIssue) {
      const inferred = inferDates(collectDates(frontText));
      if (!dateOfBirth && inferred.dateOfBirth) dateOfBirth = inferred.dateOfBirth;
      if (!dateOfExpiry && inferred.dateOfExpiry) {
        dateOfExpiry = inferred.dateOfExpiry;
      }
      if (!dateOfIssue && inferred.dateOfIssue) dateOfIssue = inferred.dateOfIssue;
    }

    // Issue date is exactly 10 years before expiry on Indian passports
    if (!dateOfIssue && isIsoDate(dateOfExpiry)) {
      const year = Number(dateOfExpiry.slice(0, 4)) - 10;
      dateOfIssue = `${year}${dateOfExpiry.slice(4)}`;
    }

    const sex = (parsed?.sex || visual.sex || '') as '' | 'M' | 'F' | 'X';

    let fathersName = backDetails.fathersName;
    let mothersName = backDetails.mothersName;
    if (!fathersName || !mothersName) {
      const positional = extractParentsPositional(backText);
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
      confidence: Math.max(
        mrzBlock.confidence || 0,
        mrzColumn.confidence || 0,
        bestVisualConfidence
      ),
      warnings,
    };
  } finally {
    await worker.terminate();
  }
}
