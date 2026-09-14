'use client';

import {
  UnderlineField,
  UnderlineSelect,
} from '@/components/apply/form/UnderlineField';
import type {
  ApplyTripQuestion,
  TravellerTripDetails,
} from '@/lib/apply/applicationForm';
import { toIsoDate, TRIP_PURPOSE_OPTIONS } from '@/lib/apply/applicationForm';

interface TripDetailsTabProps {
  trip: TravellerTripDetails;
  countryName: string;
  extraQuestions: ApplyTripQuestion[];
  onChange: (next: TravellerTripDetails) => void;
}

export function TripDetailsTab({
  trip,
  countryName,
  extraQuestions,
  onChange,
}: TripDetailsTabProps) {
  const set = (key: keyof TravellerTripDetails) => (value: string) => {
    onChange({ ...trip, [key]: value });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-basier text-xl text-portrait-ink">Trip details</h2>
        <p className="mt-1 text-sm text-slate-helper">
          Tell us how this traveller plans to enter {countryName}. These
          fields match what most visa desks ask after passport details.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <UnderlineSelect
          label="Purpose of visit"
          required
          value={trip.purpose}
          onChange={set('purpose')}
        >
          <option value="">Select</option>
          {TRIP_PURPOSE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </UnderlineSelect>
        <UnderlineField
          label="Arrival city / port of entry"
          value={trip.arrivalCity}
          onChange={set('arrivalCity')}
        />
        <UnderlineField
          label="Intended arrival date"
          required
          type="date"
          value={trip.arrivalDate}
          onChange={(value) => set('arrivalDate')(toIsoDate(value) || value)}
        />
        <UnderlineField
          label="Intended return date"
          required
          type="date"
          value={trip.returnDate}
          onChange={(value) => set('returnDate')(toIsoDate(value) || value)}
        />
        <UnderlineField
          label="Arrival flight number"
          value={trip.flightNumber}
          onChange={(value) => set('flightNumber')(value.toUpperCase())}
        />
        <UnderlineField
          label="Hotel / accommodation name"
          value={trip.accommodationName}
          onChange={set('accommodationName')}
        />
        <div className="sm:col-span-2">
          <UnderlineField
            label="Stay address"
            value={trip.accommodationAddress}
            onChange={set('accommodationAddress')}
          />
        </div>
      </div>

      {extraQuestions.length > 0 && (
        <div className="pt-2">
          <h3 className="font-basier text-lg text-portrait-ink">
            Extra questions for this visa
          </h3>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {extraQuestions.map((question) => {
              const value = trip.extra[question.key] ?? '';
              const update = (next: string) =>
                onChange({
                  ...trip,
                  extra: { ...trip.extra, [question.key]: next },
                });

              if (question.type === 'boolean') {
                return (
                  <label
                    key={question.id}
                    className="flex items-start gap-3 sm:col-span-2"
                  >
                    <input
                      type="checkbox"
                      checked={value === 'true'}
                      onChange={(event) =>
                        update(event.target.checked ? 'true' : 'false')
                      }
                      className="mt-1 h-4 w-4 rounded border-ash"
                    />
                    <span>
                      <span className="block text-sm font-medium text-portrait-ink">
                        {question.label}
                        {question.required && (
                          <span className="text-[#ff4940]"> *</span>
                        )}
                      </span>
                      {question.description && (
                        <span className="mt-0.5 block text-xs text-slate-helper">
                          {question.description}
                        </span>
                      )}
                    </span>
                  </label>
                );
              }

              if (question.type === 'select') {
                return (
                  <UnderlineSelect
                    key={question.id}
                    label={question.label}
                    required={question.required}
                    value={value}
                    onChange={update}
                  >
                    <option value="">Select</option>
                    {(question.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </UnderlineSelect>
                );
              }

              return (
                <UnderlineField
                  key={question.id}
                  label={question.label}
                  required={question.required}
                  type={question.type === 'date' ? 'date' : 'text'}
                  value={value}
                  onChange={update}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
