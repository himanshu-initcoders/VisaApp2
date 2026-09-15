'use client';

import type { ReactNode } from 'react';
import { DocumentsReviewSection } from '@/components/apply/review/DocumentsReviewSection';
import { ReviewFieldGrid } from '@/components/apply/review/ReviewFieldGrid';
import { TripDetailsReview } from '@/components/apply/review/TripDetailsReview';
import { PASSPORT_REVIEW_GROUPS } from '@/lib/apply/reviewFields';
import type {
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
}

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-ash bg-white p-5 shadow-sm">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
        {title}
      </h3>
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
}: ReviewSubmitTabProps) {
  const hasAdditional = extraQuestions.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-basier text-xl text-portrait-ink">
          Review &amp; submit
        </h2>
        <p className="mt-1 text-sm text-slate-helper">
          Check this traveller&apos;s {countryName} application before you save
          it. You can still edit from the tabs above.
        </p>
      </div>

      {showGeneralInfo && (
        <ReviewSection title="General details">
          <ReviewFieldGrid groups={PASSPORT_REVIEW_GROUPS} data={fields} />
        </ReviewSection>
      )}

      {showTripDetails && (
        <ReviewSection title="Trip details">
          <TripDetailsReview
            trip={trip}
            includeCore
            includeExtra={false}
            showEmpty
          />
        </ReviewSection>
      )}

      {hasAdditional && (
        <ReviewSection title="Additional questions">
          <TripDetailsReview
            trip={trip}
            extraQuestions={extraQuestions}
            includeCore={false}
            includeExtra
            showEmpty
          />
        </ReviewSection>
      )}

      <ReviewSection title="Documents">
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
