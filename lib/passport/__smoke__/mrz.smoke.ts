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
  issueDateFromExpiry,
  classifyPages,
  isPassportMrzLine,
  validateTd3,
  mrzCheckDigit,
  repairWithCheckDigit,
  IndianPassportError,
} from '../extractIndianPassport';
import {
  extractBackPageDetails,
  hasBackPageEvidence,
  looksLikeFrontPage,
} from '../backPage';
import {
  choosePagesToPromote,
  scoreBackPageCandidate,
} from '../pageSelect';

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
  { currentPassportNumber: 'X6337086', allowPositionalNames: true }
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
10 5TH CRS FLAT NO 01 COMFORT GANGA LAKSHMI APT
PIN:560076,KARNATAKA,INDIA`
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

// ---------------------------------------------------------------------------
// Regressions from the sample corpus in /Passports
// ---------------------------------------------------------------------------

// A single-page upload has no back page. The data page must never be mined
// for parents, or the holder's own name lands in father/mother.
const dataPageOnly = `भारत गणराज्य / REPUBLIC OF INDIA
P   IND   भारतीय / INDIAN   U8193188
उपनाम / Surname
PISIPATI
दिया गया नाम / Given Name(s)
SAI ANURAG
जन्मतिथि / Date of Birth
30/06/1998
जारी करने की तिथि / Date of Issue
14/12/2020
समाप्ति की तिथि / Date of Expiry
13/12/2030
P<INDPISIPATI<<SAI<ANURAG<<<<<<<<<<<<<<<<<<<
U8193188<8IND9806308M3012132106312197072O<36`;

assert(!hasBackPageEvidence(dataPageOnly), 'data page has no back-page evidence');
assert(looksLikeFrontPage(dataPageOnly), 'data page recognised as front');

const bleed = extractBackPageDetails(dataPageOnly, {
  currentPassportNumber: 'U8193188',
  holderNames: ['PISIPATI', 'SAI ANURAG'],
});
assert(!bleed.fathersName, `front-page bleed into father: ${bleed.fathersName}`);
assert(!bleed.mothersName, `front-page bleed into mother: ${bleed.mothersName}`);

const bleedPositional = extractParentsPositional(dataPageOnly, {
  holderNames: ['PISIPATI', 'SAI ANURAG'],
});
assert(
  !bleedPositional.fathersName && !bleedPositional.mothersName,
  'positional guessing refused on data page'
);

// Even on a real back page, the holder's full name is not a parent — but the
// surname alone is, because that is often the father's given name.
const holderEcho = extractBackPageDetails(
  `Name of Father / Legal Guardian
PISIPATI
Name of Mother
LAKSHMI DEVI
PIN:500081,TELANGANA,INDIA`,
  { holderNames: ['PISIPATI', 'SAI ANURAG'], allowPositionalNames: true }
);
assert(
  holderEcho.fathersName === 'PISIPATI',
  `labeled surname-as-father dropped: ${holderEcho.fathersName}`
);
assert(
  holderEcho.mothersName === 'LAKSHMI DEVI',
  `real mother lost: ${holderEcho.mothersName}`
);

const holderFull = extractBackPageDetails(
  `Name of Father / Legal Guardian
PISIPATI SAI ANURAG
Name of Mother
LAKSHMI DEVI
PIN:500081,TELANGANA,INDIA`,
  { holderNames: ['PISIPATI', 'SAI ANURAG'] }
);
assert(
  holderFull.fathersName !== 'PISIPATI SAI ANURAG',
  `full holder name accepted as father: ${holderFull.fathersName}`
);

// A Schengen visa page (MRV-A) carries an IND nationality and a date triple,
// so it used to pass the India gate and overwrite the passport fields.
assert(
  !isPassportMrzLine('VCAUTGODOGULA<<ESWARA<KUMAR<<<<<<<<<<'),
  'visa MRZ line rejected'
);
assert(!isPassportMrzLine('PIN500039TELANGANAINDIA'), 'PIN code rejected as MRZ');
assert(!isPassportMrzLine('P<IN5TELANGANAINDIA'), 'PIN rewritten as P< rejected');
assert(isPassportMrzLine('P<INDPISIPATI<<SAI<ANURAG<<<<'), 'passport MRZ accepted');
try {
  parseAndValidateMrz([
    'VCAUTGODOGULA<<ESWARA<KUMAR<<<<<<<<<<',
    '0114895642IND8403098M2511155<M311001',
  ]);
  throw new Error('expected visa rejection');
} catch (error) {
  assert(error instanceof IndianPassportError, 'visa MRZ throws');
}
// correctMrzLine1 must not launder a visa line into P<
assert(
  !correctMrzOcrArtifacts('VCAUTGODOGULA<<ESWARA<KUMAR', 'line1').startsWith('P<'),
  'visa line 1 not rewritten as passport'
);

// TD3 structure: all four check digits on a real MRZ
const amar = validateTd3([
  'P<INDSABALE<<AMAR<NAMADEO<<<<<<<<<<<<<<<<<<<',
  'X4659979<6IND8806013M3403048693046504244<84',
]);
assert(amar.isPassportType, 'Amar is passport type');
assert(amar.hasTd3Layout, 'Amar has TD3 layout');
assert(amar.numberCheckOk, 'Amar number check');
assert(amar.birthCheckOk, 'Amar birth check');
assert(amar.expiryCheckOk, 'Amar expiry check');

// A notarised booklet spread mixes in an old-passport date and a notary date.
// Neither may become the date of birth or the date of issue.
const govindDates = collectDates(
  `15/02/1990 07/06/2017 06/06/2027 G4539773 13/08/2007 BENGALURU 14 MAY 2018`
);
const govind = inferDates(govindDates, { todayIso: '2026-09-14' });
assert(
  govind.dateOfBirth === '1990-02-15',
  `govind dob ${govind.dateOfBirth}`
);
assert(
  govind.dateOfExpiry === '2027-06-06',
  `govind expiry ${govind.dateOfExpiry}`
);
assert(
  govind.dateOfIssue === '2017-06-07',
  `govind issue ${govind.dateOfIssue}`
);

// MRZ-anchored dates are never overridden by whatever else is on the sheet
const anchored = inferDates(['2007-08-13', '2018-05-14', '2035-01-01'], {
  dateOfBirth: '1990-02-15',
  dateOfExpiry: '2027-06-06',
  todayIso: '2026-09-14',
});
assert(anchored.dateOfBirth === '1990-02-15', `anchored dob ${anchored.dateOfBirth}`);
assert(
  anchored.dateOfExpiry === '2027-06-06',
  `anchored expiry ${anchored.dateOfExpiry}`
);

// Issue date is one day short of the validity anniversary, not a plain -10y
assert(
  issueDateFromExpiry('2034-03-04') === '2024-03-05',
  `issue from expiry ${issueDateFromExpiry('2034-03-04')}`
);
assert(
  issueDateFromExpiry('2030-12-13') === '2020-12-14',
  `issue from expiry ${issueDateFromExpiry('2030-12-13')}`
);

// A minor's 5-year passport must not be back-dated by 10 years
const minor = inferDates([], {
  dateOfBirth: '2015-04-02',
  dateOfExpiry: '2027-08-10',
  todayIso: '2026-09-14',
});
assert(minor.dateOfIssue === '2022-08-11', `minor issue ${minor.dateOfIssue}`);

// classifyPages must report "no back page" rather than guessing, so a visa
// page or a blank sheet cannot feed the parent fields.
const frontOnlyPair = classifyPages([dataPageOnly, 'VISUM/VISA AUT Schengen']);
assert(frontOnlyPair.front === 0, `front index ${frontOnlyPair.front}`);
assert(frontOnlyPair.back === -1, `back should be -1, got ${frontOnlyPair.back}`);

const realPair = classifyPages([
  dataPageOnly,
  'Name of Father / Legal Guardian\nNARPAT SINGH\nName of Mother\nAKANSHA\nAddress\nPIN:342006',
]);
assert(realPair.front === 0 && realPair.back === 1, 'real front/back pair');

// Compound surname: a single < is a space, not a given-name separator
const lakshman = parseAndValidateMrz([
  'P<INDTIRUNELVELI<SARANGAPANI<<LAKSHMANAMURTH',
  'R2895197<6IND5907104M2707163<<<<<<<<<<<<<<<2',
]);
assert(
  lakshman.surname === 'TIRUNELVELI SARANGAPANI',
  `compound surname ${lakshman.surname}`
);
assert(
  lakshman.givenNames.startsWith('LAKSHMANAMURTH'),
  `lakshman given ${lakshman.givenNames}`
);

// Long given names on the printed zone must not be thrown away as garbage
const dilipVisual = extractVisualZoneIdentity(`
Surname
MANNE
Given Name(s)
DILIP NAGAVENKATASATYASIVASAIKRISHNA
`);
assert(
  dilipVisual.givenNames === 'DILIP NAGAVENKATASATYASIVASAIKRISHNA',
  `long given dropped: ${dilipVisual.givenNames}`
);

// 10-page booklet: data page on p1 must still promote p10 (particulars)
const booklet = choosePagesToPromote(
  [
    { pageNumber: 1, mrzScore: 80, backScore: 0 },
    { pageNumber: 2, mrzScore: 12, backScore: 0 },
    { pageNumber: 3, mrzScore: 8, backScore: 0 },
    { pageNumber: 10, mrzScore: 0, backScore: 0 },
  ],
  10
);
assert(booklet.includes(1), 'booklet keeps data page');
assert(booklet.includes(10), 'booklet keeps last page');
assert(booklet.includes(2), 'booklet keeps neighbour of data page');

const twoPage = choosePagesToPromote(
  [
    { pageNumber: 1, mrzScore: 50, backScore: 0 },
    { pageNumber: 2, mrzScore: 0, backScore: 0 },
  ],
  2
);
assert(twoPage.join(',') === '1,2', `short pdf ${twoPage.join(',')}`);

// After the data page is known, a visa MRZ page must lose to the last page
const visaVsBack =
  scoreBackPageCandidate(
    { pageNumber: 3, bandScore: 55, textLayer: 'VISUM/VISA AUT' },
    2,
    3
  ) <
  scoreBackPageCandidate(
    { pageNumber: 1, bandScore: 4, textLayer: '' },
    2,
    3
  );
assert(visaVsBack, 'back page ranks above visa page');

console.log('MRZ + visual smoke checks passed');
console.log(JSON.stringify({ line1, parsed, harsh, visual, parents }, null, 2));
