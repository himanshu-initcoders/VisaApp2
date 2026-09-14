/**
 * Expected fields for the sample corpus in /Passports, transcribed by hand
 * from the MRZ and printed zone of each document.
 *
 * Only fields that are actually legible in the sample are listed; anything
 * omitted is not scored. `layout` records why each file is in the corpus, so a
 * regression can be traced to the scenario it broke.
 */

export interface SampleExpectation {
  file: string;
  /** The upload scenario this sample represents. */
  layout: string;
  passportNumber?: string;
  surname?: string;
  givenNames?: string;
  dateOfBirth?: string;
  sex?: 'M' | 'F';
  dateOfIssue?: string;
  dateOfExpiry?: string;
  placeOfBirth?: string;
  placeOfIssue?: string;
  fathersName?: string;
  mothersName?: string;
}

export const GROUND_TRUTH: SampleExpectation[] = [
  {
    file: 'Amar Sabale Passport.pdf',
    layout: '2-page PDF, landscape /Rotate 90, tight data page crop then back',
    passportNumber: 'X4659979',
    surname: 'SABALE',
    givenNames: 'AMAR NAMADEO',
    dateOfBirth: '1988-06-01',
    sex: 'M',
    dateOfIssue: '2024-03-05',
    dateOfExpiry: '2034-03-04',
    placeOfBirth: 'BARAMATI,MAHARASHTRA',
    placeOfIssue: 'PUNE',
    fathersName: 'NAMADEO BAPURAO SABALE',
    mothersName: 'MANISHA NAMADEO SABALE',
  },
  {
    file: 'Anurag_Pisipati_Passport.png',
    layout: 'Single PNG, cropped data page only, no back page',
    passportNumber: 'U8193188',
    surname: 'PISIPATI',
    givenNames: 'SAI ANURAG',
    dateOfBirth: '1998-06-30',
    sex: 'M',
    dateOfIssue: '2020-12-14',
    dateOfExpiry: '2030-12-13',
    placeOfBirth: 'HYDERABAD,TELANGANA',
    placeOfIssue: 'HYDERABAD',
  },
  {
    file: 'Muniraj Chinnaswamy Passport.pdf',
    layout:
      '10-page booklet PDF; data page on p1 (spread with stamps), particulars on p10',
    passportNumber: 'U2644256',
    surname: 'CHINNASWAMY',
    givenNames: 'MUNIRAJ',
    dateOfBirth: '1955-02-10',
    sex: 'M',
    dateOfIssue: '2021-01-05',
    dateOfExpiry: '2031-01-04',
    placeOfBirth: 'BENGALURU,KARNATAKA',
    placeOfIssue: 'BENGALURU',
    fathersName: 'CHINNASWAMY',
    mothersName: 'SAROJAMMA',
  },
  {
    file: 'Passport_Govind Bajaj.pdf',
    layout:
      'Single page: whole booklet spread, notary stamp, attested-copy text, /Rotate 270',
    passportNumber: 'Z4273405',
    surname: 'BAJAJ',
    givenNames: 'GOVIND',
    dateOfBirth: '1990-02-15',
    sex: 'M',
    dateOfIssue: '2017-06-07',
    dateOfExpiry: '2027-06-06',
    placeOfBirth: 'DOMBIVLI,MAHARASHTRA',
    placeOfIssue: 'BENGALURU',
    fathersName: 'NARAYANLAL BAJAJ',
    mothersName: 'PREMLATA BAJAJ',
  },
  {
    file: 'Pradeep_Kumar_Ratanlal_Passport.jpeg',
    layout: 'Phone photo, 16:9, hand and wooden desk in frame, front only',
    passportNumber: 'Z7225700',
    surname: 'RATANLAL',
    givenNames: 'PRADEEP KUMAR',
    dateOfBirth: '1970-09-05',
    sex: 'M',
    dateOfIssue: '2023-03-15',
    dateOfExpiry: '2033-03-14',
    placeOfBirth: 'PALLI,RAJASTHAN',
    placeOfIssue: 'BENGALURU',
  },
  {
    file: 'Sunil Karpe Passport.pdf',
    layout: '2-page PDF, /Rotate 270, carries a noisy scanner OCR text layer',
    passportNumber: 'Z5973720',
    surname: 'KARPE',
    givenNames: 'SUNIL KUMAR SUBHASH',
    dateOfBirth: '1977-05-30',
    sex: 'M',
    dateOfIssue: '2020-02-18',
    dateOfExpiry: '2030-02-17',
    placeOfBirth: 'PARNER,MAHARASHTRA',
    placeOfIssue: 'HYDERABAD',
    fathersName: 'SUBHASH TARACHAND KARPE',
    mothersName: 'SHAKUNTALA SUBHASH KARPE',
  },
  {
    file: 'Eswara Passport.pdf',
    layout:
      '3-page PDF: p1 back rotated 90, p2 data page rotated 90, p3 Schengen visa MRZ',
    passportNumber: 'Z7995848',
    surname: 'GODUGULA',
    givenNames: 'ESWARA KUMAR',
    dateOfBirth: '1984-03-09',
    sex: 'M',
    dateOfIssue: '2024-09-10',
    dateOfExpiry: '2034-09-09',
    placeOfBirth: 'GOLLAPROLU,ANDHRA PRADESH',
    placeOfIssue: 'HYDERABAD',
    fathersName: 'TATA RAO GODUGULA',
    mothersName: 'MANGA GODUGULA',
  },
  {
    file: 'Dilip Passport.pdf',
    layout:
      '2-page portrait A4 CamScanner PDF; long given name truncated in MRZ',
    passportNumber: 'T1131439',
    surname: 'MANNE',
    givenNames: 'DILIP NAGAVENKATASATYASIVASAIKRISHNA',
    dateOfBirth: '1997-11-10',
    sex: 'M',
    dateOfIssue: '2019-04-16',
    dateOfExpiry: '2029-04-15',
    placeOfBirth: 'BHIMAVARAM,ANDHRA PRADESH',
    placeOfIssue: 'HYDERABAD',
    fathersName: 'VENKATA KANAKA VARA PRASAD MANNE',
    mothersName: 'HARITHA MANNE',
  },
  {
    file: 'Gaurav Lahoti Passport.pdf',
    layout:
      '2-page portrait US-Letter; small data page on white sheet, back page skewed',
    passportNumber: 'Y8378532',
    surname: 'LAHOTI',
    givenNames: 'GAURAV',
    dateOfBirth: '2007-07-04',
    sex: 'M',
    dateOfIssue: '2023-08-28',
    dateOfExpiry: '2033-08-27',
    placeOfBirth: 'HYDERABAD,TELANGANA',
    placeOfIssue: 'BENGALURU',
    fathersName: 'JAGADISH LAHOTI',
    mothersName: 'SARIKA LAHOTI',
  },
  {
    file: 'Girish Pandagre Passport.pdf',
    layout: '2-page portrait A4, data page under a visa leaf, low-resolution scan',
    passportNumber: 'Y3075160',
    surname: 'PANDAGRE',
    givenNames: 'GIRISH KUMAR',
    dateOfBirth: '1990-08-07',
    sex: 'M',
    dateOfIssue: '2024-05-22',
    dateOfExpiry: '2034-05-21',
    placeOfBirth: 'BHADRAPALI,CHHATTISGARH',
    placeOfIssue: 'MUMBAI',
    fathersName: 'MAHADEV RAO PANDAGRE',
    mothersName: 'SUMAN PANDAGRE',
  },
  {
    file: 'Rajashekar Passport.pdf',
    layout: '2-page PDF with JBIG2 bilevel images — needs the pdf.js wasm decoder',
    fathersName: 'VENKAT REDDY PADAMATI',
    mothersName: 'KAMALAMMA PADAMATI',
  },
  {
    file: 'Rekha_Pradeep_Passport.jpeg',
    layout: 'Phone photo, 16:9, hand in frame, front only',
    passportNumber: 'Z5854187',
    surname: 'PRADEEP',
    givenNames: 'REKHA',
    dateOfBirth: '1975-10-07',
    sex: 'F',
    dateOfIssue: '2023-02-28',
    dateOfExpiry: '2033-02-27',
    placeOfBirth: 'PALI,RAJASTHAN',
    placeOfIssue: 'BENGALURU',
  },
  {
    file: 'Revanth Akula Passport.pdf',
    layout: '2-page PDF, /Rotate 270 with portrait source images',
    passportNumber: 'P8821778',
    surname: 'AKULA',
    givenNames: 'REVANTH',
    dateOfBirth: '1997-02-16',
    sex: 'M',
    dateOfIssue: '2017-03-22',
    dateOfExpiry: '2027-03-21',
    placeOfBirth: 'IBRAHIMPATNAM,TELANGANA',
    placeOfIssue: 'HYDERABAD',
    fathersName: 'SURESH AKULA',
    mothersName: 'VINODINI AKULA',
  },
  {
    file: 'TS Lakshman Passport.pdf',
    layout:
      '2-page portrait A4 at 300dpi; compound surname with a single < in the MRZ',
    passportNumber: 'R2895197',
    surname: 'TIRUNELVELI SARANGAPANI',
    givenNames: 'LAKSHMANAMURTHY',
    dateOfBirth: '1959-07-10',
    sex: 'M',
    dateOfIssue: '2017-07-17',
    dateOfExpiry: '2027-07-16',
    placeOfBirth: 'BENGALURU,KARNATAKA',
    placeOfIssue: 'BENGALURU',
    fathersName: 'SARANGAPANI',
    mothersName: 'CHELLAMMAL',
  },
];

/** Fields that are scored when present in the expectation. */
export const SCORED_FIELDS = [
  'passportNumber',
  'surname',
  'givenNames',
  'dateOfBirth',
  'sex',
  'dateOfIssue',
  'dateOfExpiry',
  'placeOfBirth',
  'placeOfIssue',
  'fathersName',
  'mothersName',
] as const satisfies ReadonlyArray<keyof SampleExpectation>;
