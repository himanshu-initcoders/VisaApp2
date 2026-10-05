import {
  emptyTripDetails,
  getCoreTripIssues,
  getMultiStopIssues,
  type ApplyFormConfig,
  type TravellerTripDetails,
} from '@/lib/apply/applicationForm';

export interface SubmitTravellerPayload {
  id: string;
  name: string;
  passportData?: Record<string, unknown> | null;
  tripDetails?: Record<string, unknown> | null;
  documents?: Array<{
    key: string;
    name?: string;
    mimeType?: string;
    size?: number;
  }>;
  passportUploaded?: boolean;
  photoUploaded?: boolean;
  applicationComplete?: boolean;
}

export function validateSubmitTravellers(
  travellers: SubmitTravellerPayload[],
  snapshot: ApplyFormConfig
): string | null {
  if (!travellers.length) {
    return 'Add at least one traveller before submitting.';
  }

  for (const traveller of travellers) {
    if (!traveller.name?.trim()) {
      return 'Each traveller needs a name.';
    }
    if (!traveller.passportData) {
      return `Complete passport details for ${traveller.name || 'each traveller'}.`;
    }

    if (snapshot.showTripDetails !== false) {
      const trip = emptyTripDetails(
        (traveller.tripDetails ?? undefined) as
          | Partial<TravellerTripDetails>
          | undefined
      );
      const issue = [
        ...getCoreTripIssues(trip),
        ...getMultiStopIssues(trip),
      ][0];
      if (issue) {
        const who = traveller.name?.trim() || 'Traveller';
        return `${who}: ${issue}`;
      }
    }
  }

  return null;
}
