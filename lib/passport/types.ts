export interface IndianPassportFields {
  passportNumber: string;
  surname: string;
  givenNames: string;
  nationality: string;
  dateOfBirth: string; // YYYY-MM-DD
  sex: 'M' | 'F' | 'X' | '';
  dateOfExpiry: string; // YYYY-MM-DD
  documentType: string;
  countryOfIssue: string;
  fathersName?: string;
  mothersName?: string;
  spouseName?: string;
  dateOfIssue?: string; // YYYY-MM-DD best-effort
  placeOfBirth?: string;
  placeOfIssue?: string;
  address?: string;
  fileNumber?: string;
  oldPassportNumber?: string;
  oldPassportDateOfIssue?: string; // YYYY-MM-DD
  oldPassportPlaceOfIssue?: string;
  email?: string;
  phone?: string;
}

export interface IndianPassportExtraction extends IndianPassportFields {
  frontPreviewUrl: string;
  backPreviewUrl?: string;
  rawMrz: [string, string];
  confidence: number;
  warnings: string[];
}

export type PassportCaptureMode = 'live' | 'upload';

export type PassportFlowStage = 'capture' | 'scan' | 'review';
