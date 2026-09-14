'use client';

import { ReviewFieldGrid } from '@/components/apply/review/ReviewFieldGrid';
import {
  PASSPORT_REVIEW_GROUPS,
  formatReviewDate,
} from '@/lib/apply/reviewFields';
import {
  purposeLabel,
  type ApplyDocumentSlot,
  type ApplyTripQuestion,
  type TravellerDocumentUpload,
  type TravellerTripDetails,
} from '@/lib/apply/applicationForm';
import type { IndianPassportFields } from '@/lib/passport/types';

interface ReviewSubmitTabProps {
  fields: IndianPassportFields;
  trip: TravellerTripDetails;
  extraQuestions: ApplyTripQuestion[];
  slots: ApplyDocumentSlot[];
  uploads: TravellerDocumentUpload[];
  countryName: string;
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-helper">{label}</dt>
      <dd className="truncate text-sm font-medium text-portrait-ink">{value}</dd>
    </div>
  );
}

export function ReviewSubmitTab({
  fields,
  trip,
  extraQuestions,
  slots,
  uploads,
  countryName,
}: ReviewSubmitTabProps) {
  const byKey = new Map(uploads.map((item) => [item.key, item]));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="font-basier text-xl text-portrait-ink">
          Review &amp; submit
        </h2>
        <p className="mt-1 text-sm text-slate-helper">
          Check this traveller&apos;s {countryName} application before you save
          it. You can still edit from the tabs above.
        </p>
      </div>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
          General details
        </h3>
        <div className="mt-3">
          <ReviewFieldGrid groups={PASSPORT_REVIEW_GROUPS} data={fields} />
        </div>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
          Trip details
        </h3>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Row label="Purpose" value={purposeLabel(trip.purpose)} />
          <Row label="Arrival city" value={trip.arrivalCity} />
          <Row
            label="Arrival date"
            value={trip.arrivalDate ? formatReviewDate(trip.arrivalDate) : ''}
          />
          <Row
            label="Return date"
            value={trip.returnDate ? formatReviewDate(trip.returnDate) : ''}
          />
          <Row label="Flight number" value={trip.flightNumber} />
          <Row label="Accommodation" value={trip.accommodationName} />
          <Row label="Stay address" value={trip.accommodationAddress} />
          {extraQuestions.map((question) => (
            <Row
              key={question.id}
              label={question.label}
              value={
                question.type === 'boolean'
                  ? trip.extra[question.key] === 'true'
                    ? 'Yes'
                    : 'No'
                  : trip.extra[question.key]
              }
            />
          ))}
        </dl>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
          Documents
        </h3>
        <ul className="mt-3 space-y-2">
          <li className="text-sm text-portrait-ink">Passport bio page · uploaded</li>
          {slots.map((slot) => (
            <li key={slot.id} className="text-sm text-portrait-ink">
              {slot.title} · {byKey.get(slot.key)?.name || 'Missing'}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
