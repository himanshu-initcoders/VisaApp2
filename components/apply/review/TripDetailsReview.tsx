'use client';

import { formatReviewDate } from '@/lib/apply/reviewFields';
import {
  groupApplyTripQuestions,
  purposeLabel,
  type ApplyTripQuestion,
  type TravellerTripDetails,
} from '@/lib/apply/applicationForm';
import { getVisibleExtraQuestions } from '@/lib/question-visibility';

interface TripDetailsReviewProps {
  trip: TravellerTripDetails;
  extraQuestions?: ApplyTripQuestion[];
  showEmpty?: boolean;
  /** Core trip fields (purpose, dates, hotel). Default true. */
  includeCore?: boolean;
  /** Listing additional questions. Default true. */
  includeExtra?: boolean;
}

function Row({
  label,
  value,
  showEmpty,
}: {
  label: string;
  value?: string;
  showEmpty?: boolean;
}) {
  const display = value?.trim() || (showEmpty ? 'Not provided' : '');
  if (!display) return null;
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-helper">{label}</dt>
      <dd
        className={`truncate text-sm font-medium ${
          value?.trim()
            ? 'text-portrait-ink'
            : 'text-slate-helper italic'
        }`}
      >
        {display}
      </dd>
    </div>
  );
}

function extraValue(question: ApplyTripQuestion, raw?: string) {
  if (question.type === 'boolean') {
    if (!raw) return '';
    return raw === 'true' ? 'Yes' : 'No';
  }
  if (!raw) return '';
  if (question.type === 'dropdown') {
    return (
      question.options?.find((option) => option.value === raw)?.label || raw
    );
  }
  if (question.type === 'date') return formatReviewDate(raw);
  return raw;
}

export function TripDetailsReview({
  trip,
  extraQuestions = [],
  showEmpty = false,
  includeCore = true,
  includeExtra = true,
}: TripDetailsReviewProps) {
  const questionGroups = includeExtra
    ? groupApplyTripQuestions(
        getVisibleExtraQuestions(extraQuestions, trip.extra)
      )
    : [];

  return (
    <div className="space-y-4">
      {includeCore && (
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Row
            label="Purpose"
            value={trip.purpose ? purposeLabel(trip.purpose) : ''}
            showEmpty={showEmpty}
          />
          <Row label="Arrival city" value={trip.arrivalCity} showEmpty={showEmpty} />
          <Row
            label="Arrival date"
            value={trip.arrivalDate ? formatReviewDate(trip.arrivalDate) : ''}
            showEmpty={showEmpty}
          />
          <Row
            label="Return date"
            value={trip.returnDate ? formatReviewDate(trip.returnDate) : ''}
            showEmpty={showEmpty}
          />
          <Row
            label="Flight number"
            value={trip.flightNumber}
            showEmpty={showEmpty}
          />
          <Row
            label="Accommodation"
            value={trip.accommodationName}
            showEmpty={showEmpty}
          />
          <Row
            label="Stay address"
            value={trip.accommodationAddress}
            showEmpty={showEmpty}
          />
        </dl>
      )}

      {questionGroups.map((group) => (
        <div key={group.category}>
          <h4 className="mb-2 text-sm font-medium text-portrait-ink">{group.label}</h4>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {group.questions.map((question) => (
              <Row
                key={question.id}
                label={question.label}
                value={extraValue(question, trip.extra[question.key])}
                showEmpty={showEmpty}
              />
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
