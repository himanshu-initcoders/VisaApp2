import type {
  TravellerDocumentUpload,
  TravellerTripDetails,
} from '@/lib/apply/applicationForm';
import type { IndianPassportFields } from '@/lib/passport/types';

export type ApplyStep = 'travellers' | 'documents' | 'pay';

export interface ApplyTraveller {
  id: string;
  name: string;
  photoUploaded: boolean;
  passportUploaded: boolean;
  passportData?: IndianPassportFields;
  passportFrontUrl?: string;
  passportBackUrl?: string;
  tripDetails?: TravellerTripDetails;
  documents?: TravellerDocumentUpload[];
  applicationComplete?: boolean;
  editing: boolean;
}
