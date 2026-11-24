/**
 * Shared visa-listing process type values and labels.
 * Keep schema, validation, and admin selects in sync via this module.
 */

export const PROCESS_TYPES = [
  'electronic_travel_authorisation',
  'afc',
  'visa',
  'appointment',
  'visa_on_arrival',
  'sticker_visa',
  'visa_free',
  'digital_arrival_card',
] as const;

export type ProcessType = (typeof PROCESS_TYPES)[number];

export const PROCESS_TYPE_OPTIONS: ReadonlyArray<{
  value: ProcessType;
  label: string;
}> = [
  { value: 'electronic_travel_authorisation', label: 'Electronic Travel Authorisation' },
  { value: 'afc', label: 'Application Facilitation Center' },
  { value: 'visa', label: 'Visa' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'visa_on_arrival', label: 'Visa on Arrival' },
  { value: 'sticker_visa', label: 'Sticker Visa' },
  { value: 'visa_free', label: 'Visa Free' },
  { value: 'digital_arrival_card', label: 'Digital Arrival Card' },
];

/** Digital Arrival Card is not a visa product. */
export function isDigitalArrivalCard(processType: string | null | undefined): boolean {
  return processType === 'digital_arrival_card';
}

/**
 * Process types that should use arrival-card public copy
 * (eTA / TDAC-style + Digital Arrival Card + VOA process type).
 */
export function isArrivalCardProcess(processType: string | null | undefined): boolean {
  return (
    processType === 'digital_arrival_card' ||
    processType === 'electronic_travel_authorisation' ||
    processType === 'visa_on_arrival'
  );
}

/**
 * Public listing UI: arrival-card product (not a visa).
 * Matches process type OR purpose = Arrival Card.
 */
export function usesArrivalCardCopy(input: {
  processType?: string | null;
  purpose?: string | null;
}): boolean {
  if (input.purpose === 'visa_on_arrival') return true;
  return isArrivalCardProcess(input.processType);
}

/** Lowercase product noun for sentences ("this visa" → "this arrival card"). */
export function productNoun(
  processType: string | null | undefined,
  purpose?: string | null
): 'arrival card' | 'visa' {
  return usesArrivalCardCopy({ processType, purpose }) ? 'arrival card' : 'visa';
}

/** Title-case product noun for labels ("Visa Name" → "Arrival Card Name"). */
export function productNounTitle(
  processType: string | null | undefined,
  purpose?: string | null
): 'Arrival Card' | 'Visa' {
  return usesArrivalCardCopy({ processType, purpose }) ? 'Arrival Card' : 'Visa';
}

/** Visa on Arrival / Digital Arrival Card process types. */
export function isVisaOnArrivalProcess(
  processType: string | null | undefined
): boolean {
  return (
    processType === 'visa_on_arrival' || processType === 'digital_arrival_card'
  );
}

/**
 * Info-only public listing: VOA/arrival-card process with no government,
 * service, or GST fees — show guidance, not checkout/pricing UI.
 */
export function isInfoOnlyFreeEntry(input: {
  processType?: string | null;
  priceOptions?: ReadonlyArray<{
    governmentFeeAmount: number;
    serviceFeeAmount: number;
    governmentGstFeeAmount: number;
  }>;
}): boolean {
  if (!isVisaOnArrivalProcess(input.processType)) return false;
  const options = input.priceOptions ?? [];
  if (options.length === 0) return true;
  return options.every(
    (option) =>
      option.governmentFeeAmount === 0 &&
      option.serviceFeeAmount === 0 &&
      option.governmentGstFeeAmount === 0
  );
}
