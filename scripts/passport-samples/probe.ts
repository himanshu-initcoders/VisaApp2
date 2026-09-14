/**
 * Probe the pure parsing layer with the failure scenarios found in the
 * sample corpus. No canvas/OCR needed — these are text-in, fields-out.
 *
 * Run: npx tsx scripts/passport-samples/probe.ts
 */
import {
  findTd3MrzLines,
  parseAndValidateMrz,
  mergeBackPageFields,
  extractParentsPositional,
  collectDates,
  inferDates,
} from '../../lib/passport/extractIndianPassport';

function show(label: string, value: unknown) {
  console.log(`\n### ${label}`);
  console.log(JSON.stringify(value, null, 2));
}

// --- Scenario A: front-page-only upload (Anurag png / Pradeep jpeg).
// extractIndianPassport passes the FRONT text as backText when no back page
// was detected. What does the back-page parser invent?
const anuragFrontText = `
भारत गणराज्य / REPUBLIC OF INDIA
टाईप / Type   कोड / Code   राष्ट्रीयता / Nationality   पासपोर्ट न. / Passport No.
P   IND   भारतीय / INDIAN   U8193188
उपनाम / Surname
PISIPATI
दिया गया नाम / Given Name(s)
SAI ANURAG
जन्मतिथि / Date of Birth      लिंग / Sex
30/06/1998                    M
जन्म स्थान / Place of Birth
HYDERABAD,TELANGANA
जारी करने का स्थान / Place of Issue
HYDERABAD
जारी करने की तिथि / Date of Issue
14/12/2020
समाप्ति की तिथि / Date of Expiry
13/12/2030
P<INDPISIPATI<<SAI<ANURAG<<<<<<<<<<<<<<<<<<<
U8193188<8IND9806308M3012132106312197072O<36
`;

show(
  'A1. mergeBackPageFields(FRONT text) — should find nothing',
  mergeBackPageFields(anuragFrontText, { currentPassportNumber: 'U8193188' })
);
show(
  'A2. extractParentsPositional(FRONT text) — should find nothing',
  extractParentsPositional(anuragFrontText)
);

// --- Scenario B: Schengen visa page in the same PDF (Eswara p3).
// MRV-A MRZ is 2x36, not TD3 2x44. Does it get parsed as the passport?
const eswaraVisaPage = `
VISUM/VISA  OSTERREICH/AUSTRIA/AUTRICHE   AUT   0114895564
Schengen-Staaten  01-10-25  15-11-25  27995848  MULT  31
New Delhi  12-09-25
GODUGULA<<ESWARA<KUMAR
VCAUTGODOGULA<<ESWARA<KUMAR<<<<<<<<<<
0114895642IND8403098M2511155<M311001
`;

const visaLines = findTd3MrzLines(eswaraVisaPage);
show('B1. findTd3MrzLines(visa page) — should be null', visaLines);
if (visaLines) {
  try {
    show('B2. parseAndValidateMrz(visa MRZ) — should throw', parseAndValidateMrz(visaLines));
  } catch (error) {
    show('B2. parseAndValidateMrz(visa MRZ) threw', (error as Error).message);
  }
}

// --- Scenario C: notarised booklet spread (Govind Bajaj).
// Front MRZ, back-page address, an OLD passport issue date and a notary
// date all land in one text blob. Which date becomes the DOB?
const govindSheetText = `
भारत गणराज्य REPUBLIC OF INDIA
P   IND   Z4273405
BAJAJ
GOVIND
भारतीय/INDIAN   M   09/02/1990
DOMBIVLI,MAHARASHTRA
BENGALURU
07/06/2017   06/06/2027
P<INDBAJAJ<<GOVIND<<<<<<<<<<<<<<<<<<<<<<<<<<
Z4273405<6IND9002155M2706063<<<<<<<<<<<<<<<0
NARAYANLAL BAJAJ
PREMLATA BAJAJ
ARCHANA APT 3 4TH CROSS SWATHI RD
SHANTI NAGAR,BENGALURU
PIN:560027,KARNATAKA,INDIA
G4539773   13/08/2007   BENGALURU
BN1070284413917
ATTESTED TRUE COPY
PUTTARAMAIAH, B.A., LL.B  ADVOCATE & NOTARY
City Civil Court Complex, BENGALURU-560009.
14 MAY 2018
`;

const dates = collectDates(govindSheetText);
show('C1. collectDates(booklet spread)', dates);
show('C2. inferDates — dateOfBirth should be 1990-02-09', inferDates(dates));

// What the MRZ actually says, for comparison
const govindLines = findTd3MrzLines(govindSheetText);
if (govindLines) {
  const parsed = parseAndValidateMrz(govindLines);
  show('C3. MRZ truth for Govind', {
    passportNumber: parsed.passportNumber,
    dateOfBirth: parsed.dateOfBirth,
    dateOfExpiry: parsed.dateOfExpiry,
  });
}
