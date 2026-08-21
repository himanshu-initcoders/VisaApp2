/**
 * Run: npx tsx lib/passport/__smoke__/mrz.smoke.ts
 */
import {
  correctMrzOcrArtifacts,
  findTd3MrzLines,
  parseAndValidateMrz,
  extractVisualZoneIdentity,
  mergeBackPageFields,
  extractMrzPairFromText,
  extractParentsPositional,
  collectDates,
  inferDates,
  mrzCheckDigit,
  repairWithCheckDigit,
  IndianPassportError,
} from '../extractIndianPassport';
import { extractBackPageDetails } from '../backPage';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

// Corrupted like older screenshot: < misread as C/K/L
const corrupted = `
P<INDDARAK<C<CHARSH<C<K<L<K<C<C<L<L<C<<<<<<<<
ZA926446<6IND9806283M3607226<<<<<<<<<<<<<<<0
`;

const line1 = correctMrzOcrArtifacts(
  'P<INDDARAK<C<CHARSH<C<K<L<K<C<C<L<L<C<<<<<<<<',
  'line1'
);
assert(
  line1.startsWith('P<INDDARAK<<HARSH'),
  `line1 rebuild failed: ${line1}`
);

const lines = findTd3MrzLines(corrupted);
assert(lines, 'find lines');
const parsed = parseAndValidateMrz(lines!);
assert(parsed.surname === 'DARAK', `surname ${parsed.surname}`);
assert(parsed.givenNames === 'HARSH', `given ${parsed.givenNames}`);
assert(parsed.passportNumber === 'ZA926446', `no ${parsed.passportNumber}`);
assert(parsed.dateOfBirth === '1998-06-28', `dob ${parsed.dateOfBirth}`);
assert(parsed.sex === 'M', `sex ${parsed.sex}`);

// Real sample from user screenshot: HARSH / HEERABEN
const harshMrz = `
P<INDHARSH<<HEERABEN<<<<<<<<<<<<<<<<<<<<<<
ZA926446<6IND8607245M360722610771749266136
`;
const harshPair = extractMrzPairFromText(harshMrz);
assert(harshPair, 'harsh pair');
const harsh = parseAndValidateMrz(harshPair!);
assert(harsh.surname === 'HARSH', `harsh surname ${harsh.surname}`);
assert(harsh.givenNames === 'HEERABEN', `harsh given ${harsh.givenNames}`);
assert(harsh.passportNumber === 'ZA926446', `harsh no ${harsh.passportNumber}`);
assert(harsh.dateOfBirth === '1986-07-24', `harsh dob ${harsh.dateOfBirth}`);
assert(harsh.sex === 'M', `harsh sex ${harsh.sex}`);
assert(harsh.dateOfExpiry === '2036-07-22', `harsh exp ${harsh.dateOfExpiry}`);

const visual = extractVisualZoneIdentity(`
Passport No. ZA926446
Surname / Nom
HARSH
Given Name(s)
HEERABEN
Date of Birth / Date de naissance
24/07/1986
Sex / Sexe
M
Date of Issue / Date de délivrance
23/07/2026
Date of Expiry / Date d'expiration
22/07/2036
`);
assert(visual.passportNumber === 'ZA926446', `visual no ${visual.passportNumber}`);
assert(visual.surname === 'HARSH', `visual surname ${visual.surname}`);
assert(visual.givenNames === 'HEERABEN', `visual given ${visual.givenNames}`);
assert(visual.dateOfBirth === '1986-07-24', `visual dob ${visual.dateOfBirth}`);
assert(visual.dateOfIssue === '2026-07-23', `visual issue ${visual.dateOfIssue}`);
assert(visual.sex === 'M', `visual sex ${visual.sex}`);
assert(visual.dateOfExpiry === '2036-07-22', `visual exp ${visual.dateOfExpiry}`);

const parents = mergeBackPageFields(
  'Name of Father / Legal Guardian\nRAVINDRA SINGH\nName of Mother\nSAROJ DEVI'
);
assert(parents.fathersName === 'RAVINDRA SINGH', `father ${parents.fathersName}`);
assert(parents.mothersName === 'SAROJ DEVI', `mother ${parents.mothersName}`);

// Full back page, labels lost to Devanagari noise (real OCR output shape)
const backPage = extractBackPageDetails(
  `X6337086
NARPAT SINGH RATHORE
AKANSHA SHEKHAWAT

1,JAIN COLONY
PAOTA B ROAD,JODHPUR
PIN:342006,RAJASTHAN,INDIA
M2654630   07/10/2014   JAIPUR
JP01C4057755023`,
  { currentPassportNumber: 'X6337086' }
);
assert(
  backPage.fathersName === 'NARPAT SINGH RATHORE',
  `back father ${backPage.fathersName}`
);
assert(
  backPage.mothersName === 'AKANSHA SHEKHAWAT',
  `back mother ${backPage.mothersName}`
);
assert(
  backPage.address === '1, JAIN COLONY, PAOTA B ROAD, JODHPUR, PIN:342006, RAJASTHAN, INDIA',
  `back address ${backPage.address}`
);
assert(
  backPage.oldPassportNumber === 'M2654630',
  `old passport ${backPage.oldPassportNumber}`
);
assert(
  backPage.oldPassportDateOfIssue === '2014-10-07',
  `old passport date ${backPage.oldPassportDateOfIssue}`
);
assert(
  backPage.oldPassportPlaceOfIssue === 'JAIPUR',
  `old passport place ${backPage.oldPassportPlaceOfIssue}`
);
assert(
  backPage.fileNumber === 'JP01C4057755023',
  `file number ${backPage.fileNumber}`
);

// Front zone extras
const frontExtras = extractVisualZoneIdentity(`
Nationality
INDIAN
Place of Birth
JODHPUR,RAJASTHAN
Place of Issue
JAIPUR
Date of Issue
23/06/2023
`);
assert(frontExtras.nationality === 'INDIAN', `nationality ${frontExtras.nationality}`);
assert(
  frontExtras.placeOfBirth === 'JODHPUR,RAJASTHAN',
  `place of birth ${frontExtras.placeOfBirth}`
);
assert(
  frontExtras.placeOfIssue === 'JAIPUR',
  `place of issue ${frontExtras.placeOfIssue}`
);

// Check digit repairs OCR confusions (Z read as I) in the passport number
assert(mrzCheckDigit('ZA926446<') === '6', 'check digit ZA926446');
assert(
  repairWithCheckDigit('IA926446<', '6', (v) => /^[A-Z]{1,2}\d{6,7}<*$/.test(v)) ===
    'ZA926446<',
  'repair IA926446 -> ZA926446'
);
assert(
  repairWithCheckDigit('ZA926446<', '6', (v) => /^[A-Z]{1,2}\d{6,7}<*$/.test(v)) ===
    'ZA926446<',
  'already valid number kept'
);

const misread = parseAndValidateMrz([
  'P<INDDARAK<<HARSH<<<<<<<<<<<<<<<<<<<<<<<<<<<',
  'IA926446<6IND9806283M3607226<<<<<<<<<<<<<<<0',
]);
assert(
  misread.passportNumber === 'ZA926446',
  `misread repair ${misread.passportNumber}`
);
assert(misread.passportNumberVerified, 'repaired number marked verified');
assert(misread.dateOfBirth === '1998-06-28', `misread dob ${misread.dateOfBirth}`);
assert(
  misread.dateOfExpiry === '2036-07-22',
  `misread expiry ${misread.dateOfExpiry}`
);

// Unlabeled dates on a noisy scan: birth < issue < expiry, issue = expiry - 10y
const dates = collectDates(
  'Bengaluru 28/06/1998 Rajasthan 23/07/2026 22/07/2036'
);
const inferred = inferDates(dates);
assert(inferred.dateOfBirth === '1998-06-28', `infer dob ${inferred.dateOfBirth}`);
assert(inferred.dateOfIssue === '2026-07-23', `infer issue ${inferred.dateOfIssue}`);
assert(
  inferred.dateOfExpiry === '2036-07-22',
  `infer expiry ${inferred.dateOfExpiry}`
);

// Back page without readable labels — order is father, mother, spouse, address
const positional = extractParentsPositional(
  `SHIVRATAN DARAK
SAROJ DARAK
AISHWARYA DARAK
10 5TH CRS FLAT NO 01 COMFORT GANGA LAKSHMI APT`
);
assert(
  positional.fathersName === 'SHIVRATAN DARAK',
  `positional father ${positional.fathersName}`
);
assert(
  positional.mothersName === 'SAROJ DARAK',
  `positional mother ${positional.mothersName}`
);

try {
  parseAndValidateMrz([
    'P<USADOE<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<<'.padEnd(44, '<').slice(0, 44),
    '1234567890USA8001011M2501011<<<<<<<<<<<<<<'.padEnd(44, '<').slice(0, 44),
  ]);
  throw new Error('expected IND rejection');
} catch (error) {
  assert(error instanceof IndianPassportError, 'non-IND throws');
}

console.log('MRZ + visual smoke checks passed');
console.log(JSON.stringify({ line1, parsed, harsh, visual, parents }, null, 2));
