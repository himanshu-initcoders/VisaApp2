'use client';

import { useRef, useState } from 'react';
import { FileText, Pencil, Upload } from 'lucide-react';
import { DocumentsReviewSection } from '@/components/apply/review/DocumentsReviewSection';
import { FilledBadge } from '@/components/apply/review/FilledBadge';
import { ReviewFieldGrid } from '@/components/apply/review/ReviewFieldGrid';
import { TripDetailsReview } from '@/components/apply/review/TripDetailsReview';
import { formatProfileName } from '@/lib/apply/travellerProfiles';
import { PASSPORT_REVIEW_GROUPS } from '@/lib/apply/reviewFields';
import {
  emptyTripDetails,
  type ApplyDocumentSlot,
  type ApplyTripQuestion,
} from '@/lib/apply/applicationForm';
import type { ApplyTraveller } from '@/lib/apply/types';

const PASSPORT_ACCEPT =
  'image/jpeg,image/png,image/webp,image/jpg,application/pdf';

function isPassportFile(file: File) {
  return (
    file.type.startsWith('image/') ||
    file.type === 'application/pdf' ||
    /\.(jpe?g|png|webp|pdf)$/i.test(file.name)
  );
}

interface TravellerDetailPaneProps {
  traveller: ApplyTraveller;
  name: string;
  filled: boolean;
  showGeneralInfo?: boolean;
  showTripDetails?: boolean;
  extraQuestions?: ApplyTripQuestion[];
  documentSlots?: ApplyDocumentSlot[];
  onUploadPassport: (file: File) => void;
  onFillApplication: () => void;
  onEdit: () => void;
}

export function TravellerDetailPane({
  traveller,
  name,
  filled,
  showGeneralInfo = true,
  showTripDetails = true,
  extraQuestions = [],
  documentSlots = [],
  onUploadPassport,
  onFillApplication,
  onEdit,
}: TravellerDetailPaneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const displayName = formatProfileName(name) || 'Traveller';
  const hasAdditional = extraQuestions.length > 0;

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!isPassportFile(file)) {
      setFileError('Please upload a JPG, PNG, WEBP, or PDF file.');
      return;
    }
    setFileError(null);
    onUploadPassport(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const uploads = traveller.documents ?? [];

  return (
    <div className="min-h-[360px] flex-1 rounded-[24px] border border-white bg-white p-5 shadow-card sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {filled && <FilledBadge />}
          <h2 className="truncate font-switzer text-lg font-semibold text-portrait-ink sm:text-xl">
            {displayName}
          </h2>
        </div>
        {filled && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#eef4ff] px-4 py-2 text-sm font-medium text-[#3b82f6] transition-colors hover:bg-[#dce8ff]"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit application
          </button>
        )}
      </div>

      {filled ? (
        <div className="mt-6 space-y-8">
          {showGeneralInfo && traveller.passportData && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
                General details
              </h3>
              <div className="mt-3">
                <ReviewFieldGrid
                  groups={PASSPORT_REVIEW_GROUPS}
                  data={traveller.passportData}
                />
              </div>
            </section>
          )}

          {showTripDetails && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
                Trip details
              </h3>
              <div className="mt-3">
                <TripDetailsReview
                  trip={emptyTripDetails(traveller.tripDetails)}
                  includeCore
                  includeExtra={false}
                  showEmpty
                />
              </div>
            </section>
          )}

          {hasAdditional && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
                Additional questions
              </h3>
              <div className="mt-3">
                <TripDetailsReview
                  trip={emptyTripDetails(traveller.tripDetails)}
                  extraQuestions={extraQuestions}
                  includeCore={false}
                  includeExtra
                  showEmpty
                />
              </div>
            </section>
          )}

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
              Documents
            </h3>
            <div className="mt-3">
              <DocumentsReviewSection
                slots={documentSlots}
                uploads={uploads}
                passportPreviewUrl={
                  showGeneralInfo ? traveller.passportFrontUrl : undefined
                }
                passportBackPreviewUrl={
                  showGeneralInfo ? traveller.passportBackUrl : undefined
                }
              />
            </div>
          </section>
        </div>
      ) : showGeneralInfo ? (
        <div className="mt-8 max-w-md">
          <p className="text-sm leading-6 text-slate-helper">
            Start this application by uploading the Indian passport. Details
            will show here after the form is complete.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={PASSPORT_ACCEPT}
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />
          <button
            type="button"
            onClick={() => {
              setFileError(null);
              inputRef.current?.click();
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#3b82f6] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Upload className="h-4 w-4" />
            Upload passport
          </button>
          {fileError && (
            <p className="mt-2 text-xs text-[#ff4940]">{fileError}</p>
          )}
        </div>
      ) : (
        <div className="mt-8 max-w-md">
          <p className="text-sm leading-6 text-slate-helper">
            Fill in the application details for this traveller. You can upload
            required documents in the form.
          </p>
          <button
            type="button"
            onClick={onFillApplication}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#3b82f6] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <FileText className="h-4 w-4" />
            Fill Application
          </button>
        </div>
      )}
    </div>
  );
}
