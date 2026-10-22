import type {
  TravellerDocumentUpload,
  TravellerTripDetails,
} from '@/lib/apply/applicationForm';
import type { IndianPassportFields } from '@/lib/passport/types';

export type ApplyStep = 'travellers' | 'documents' | 'pay';

/** Server-side draft file reference (synced on Save as draft). */
export interface DraftFileRef {
  slotKey: string;
  storageKey: string;
  url?: string;
  mimeType: string;
  filename: string;
  size?: number;
}

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
  /** Uploaded draft binaries on server storage (cross-browser restore). */
  draftFileRefs?: DraftFileRef[];
  applicationComplete?: boolean;
  editing: boolean;
}
