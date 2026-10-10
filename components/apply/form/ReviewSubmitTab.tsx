'use client';

import type { ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { DocumentsReviewSection } from '@/components/apply/review/DocumentsReviewSection';
import { ReviewFieldGrid } from '@/components/apply/review/ReviewFieldGrid';
import { TripDetailsReview } from '@/components/apply/review/TripDetailsReview';
import { PASSPORT_REVIEW_GROUPS } from '@/lib/apply/reviewFields';
import type {
  ApplicationFormTabId,
  ApplyDocumentSlot,
  ApplyTripQuestion,
  TravellerDocumentUpload,
  TravellerTripDetails,
} from '@/lib/apply/applicationForm';
import type { IndianPassportFields } from '@/lib/passport/types';

interface ReviewSubmitTabProps {
  fields: IndianPassportFields;
  trip: TravellerTripDetails;
  extraQuestions: ApplyTripQuestion[];
  slots: ApplyDocumentSlot[];
  uploads: TravellerDocumentUpload[];
  countryName: string;
  passportPreviewUrl?: string;
  passportBackPreviewUrl?: string;
  showGeneralInfo?: boolean;
  showTripDetails?: boolean;
  editableKeys?: ReadonlySet<string>;
  onEditSection?: (tab: ApplicationFormTabId) => void;
}

function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-ash bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
          {title}
        </h3>
        {onEdit && (
          <button
            type="button"
            aria-label={`Edit ${title}`}
            onClick={onEdit}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-[#3b82f6] transition-colors hover:bg-[#dce8ff]"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ReviewSubmitTab({
  fields,
  trip,
  extraQuestions,
  slots,
  uploads,
  countryName,
  passportPreviewUrl,
  passportBackPreviewUrl,
  showGeneralInfo = true,
  showTripDetails = true,
  editableKeys,
  onEditSection,
}: ReviewSubmitTabProps) {
  const hasAdditional = extraQuestions.length > 0;
  const edit = (tab: ApplicationFormTabId) =>
    onEditSection ? () => onEditSection(tab) : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-basier text-xl text-portrait-ink">
          Review &amp; submit
        </h2>
        <p className="mt-1 text-sm text-slate-helper">
          {editableKeys
            ? `Only the highlighted requested items for this ${countryName} application will be sent. Everything else stays as it was.`
            : `Check this traveller's ${countryName} application before you save it. You can still edit from the tabs above.`}
        </p>
      </div>

      {showGeneralInfo && (
        <ReviewSection title="Personal details" onEdit={edit('general')}>
          <ReviewFieldGrid
            groups={PASSPORT_REVIEW_GROUPS}
            data={fields}
            hideTitles={['Personal details']}
          />
        </ReviewSection>
      )}

      {showTripDetails && (
        <ReviewSection title="Trip details" onEdit={edit('trip')}>
          <TripDetailsReview
            trip={trip}
            includeCore
            includeExtra={false}
            showEmpty
          />
        </ReviewSection>
      )}

      {hasAdditional && (
        <ReviewSection title="Additional questions" onEdit={edit('additional')}>
          <TripDetailsReview
            trip={trip}
            extraQuestions={extraQuestions}
            includeCore={false}
            includeExtra
            showEmpty
          />
        </ReviewSection>
      )}

      <ReviewSection title="Documents" onEdit={edit('documents')}>
        <DocumentsReviewSection
          slots={slots}
          uploads={uploads}
          passportPreviewUrl={passportPreviewUrl}
          passportBackPreviewUrl={passportBackPreviewUrl}
        />
      </ReviewSection>
    </div>
  );
}
