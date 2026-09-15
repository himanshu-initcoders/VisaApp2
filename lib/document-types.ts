/**
 * Hardcoded document types for Form Builder document requirements.
 * `value` is the stable documentType slug; `label` is shown to admins and applicants.
 */
export const DOCUMENT_TYPES = [
  // Identity & travel document
  { value: 'passport', label: 'Passport (biodata page)' },
  { value: 'passport_back', label: 'Passport (back / address page)' },
  { value: 'passport_copy', label: 'Passport copy (all pages)' },
  { value: 'old_passport', label: 'Old / previous passport' },
  { value: 'photo', label: 'Passport photo' },
  { value: 'national_id', label: 'National ID' },
  { value: 'india_aadhaar', label: 'Aadhaar card' },
  { value: 'pan_card', label: 'PAN card' },
  { value: 'voter_id', label: 'Voter ID' },
  { value: 'driving_licence', label: 'Driving licence' },

  // Travel plans
  { value: 'flight_tickets', label: 'Flight tickets / reservation' },
  { value: 'return_flight', label: 'Return flight booking' },
  { value: 'travel_itinerary', label: 'Travel itinerary' },
  { value: 'hotel_details', label: 'Hotel booking' },
  { value: 'accommodation_proof', label: 'Proof of accommodation' },
  { value: 'travel_insurance', label: 'Travel medical insurance' },

  // Financial means
  { value: 'bank_statements', label: 'Bank statements (3–6 months)' },
  { value: 'salary_slips', label: 'Salary slips' },
  { value: 'itr', label: 'Income tax return (ITR)' },
  { value: 'form_16', label: 'Form 16' },
  { value: 'sponsorship_affidavit', label: 'Sponsorship / financial affidavit' },

  // Employment / education
  { value: 'employment_letter', label: 'Employment letter' },
  { value: 'leave_letter', label: 'Leave approval letter' },
  { value: 'business_registration', label: 'Business registration proof' },
  { value: 'company_letter', label: 'Company invitation / cover letter' },
  { value: 'student_id', label: 'Student ID' },
  { value: 'enrollment_letter', label: 'School / university enrollment letter' },
  { value: 'education_certificate', label: 'Education certificate' },

  // Visit purpose
  { value: 'invitation_letter', label: 'Invitation letter (host / family)' },
  { value: 'host_id_copy', label: 'Host ID / residence proof' },
  { value: 'sponsor_letter', label: 'Sponsor letter' },
  { value: 'conference_invitation', label: 'Conference / event invitation' },
  { value: 'cover_letter', label: 'Cover letter' },

  // Civil / family
  { value: 'marriage_certificate', label: 'Marriage certificate' },
  { value: 'birth_certificate', label: 'Birth certificate' },
  { value: 'relationship_proof', label: 'Proof of relationship' },
  { value: 'noc_minors', label: 'NOC / consent letter (minors)' },

  // Residence & ties
  { value: 'residence_proof', label: 'Proof of residence' },
  { value: 'property_proof', label: 'Property ownership proof' },
  { value: 'previous_visas', label: 'Previous visas / entry stamps copy' },

  // Other common
  { value: 'visa_application_form', label: 'Signed visa application form' },
  { value: 'appointment_confirmation', label: 'Appointment confirmation' },
  { value: 'fee_receipt', label: 'Visa fee payment receipt' },
  { value: 'police_clearance', label: 'Police clearance / PCC' },
  { value: 'noc_employer', label: 'NOC from employer' },
  { value: 'covid_vaccine', label: 'COVID vaccine certificate' },
] as const;

export type DocumentTypeValue = (typeof DOCUMENT_TYPES)[number]['value'];

export const DOCUMENT_TYPE_VALUES = DOCUMENT_TYPES.map((t) => t.value) as [
  DocumentTypeValue,
  ...DocumentTypeValue[],
];

export function documentTypeLabel(value: string): string {
  const match = DOCUMENT_TYPES.find((t) => t.value === value);
  return match?.label ?? value;
}

export function isDocumentTypeValue(value: string): value is DocumentTypeValue {
  return DOCUMENT_TYPE_VALUES.includes(value as DocumentTypeValue);
}

/** Document types that are handled as passport upload elsewhere in apply. */
export const PASSPORT_DOCUMENT_TYPES = new Set<string>([
  'passport',
  'passport_back',
  'passport_copy',
]);
