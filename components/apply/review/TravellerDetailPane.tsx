'use client';

import { useRef, useState } from 'react';
import { Pencil, Upload } from 'lucide-react';
import { FilledBadge } from '@/components/apply/review/FilledBadge';
import { ReviewFieldGrid } from '@/components/apply/review/ReviewFieldGrid';
import { formatProfileName } from '@/lib/apply/travellerProfiles';
import {
  formatReviewDate,
  PASSPORT_REVIEW_GROUPS,
} from '@/lib/apply/reviewFields';
import { purposeLabel } from '@/lib/apply/applicationForm';
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
  onUploadPassport: (file: File) => void;
  onEdit: () => void;
}

export function TravellerDetailPane({
  traveller,
  name,
  filled,
  onUploadPassport,
  onEdit,
}: TravellerDetailPaneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const displayName = formatProfileName(name) || 'Traveller';

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

      {filled && traveller.passportData ? (
        <div className="mt-6 space-y-6">
          <ReviewFieldGrid
            groups={PASSPORT_REVIEW_GROUPS}
            data={traveller.passportData}
          />
          {traveller.tripDetails && (
            <div>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
                Trip details
              </h4>
              <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-helper">Purpose</dt>
                  <dd className="text-sm font-medium text-portrait-ink">
                    {purposeLabel(traveller.tripDetails.purpose)}
                  </dd>
                </div>
                {traveller.tripDetails.arrivalDate && (
                  <div>
                    <dt className="text-xs text-slate-helper">Arrival</dt>
                    <dd className="text-sm font-medium text-portrait-ink">
                      {formatReviewDate(traveller.tripDetails.arrivalDate)}
                    </dd>
                  </div>
                )}
                {traveller.tripDetails.returnDate && (
                  <div>
                    <dt className="text-xs text-slate-helper">Return</dt>
                    <dd className="text-sm font-medium text-portrait-ink">
                      {formatReviewDate(traveller.tripDetails.returnDate)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
          {traveller.documents && traveller.documents.length > 0 && (
            <p className="text-xs text-slate-helper">
              {traveller.documents.length} supporting document
              {traveller.documents.length === 1 ? '' : 's'} uploaded
            </p>
          )}
        </div>
      ) : (
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
      )}
    </div>
  );
}
