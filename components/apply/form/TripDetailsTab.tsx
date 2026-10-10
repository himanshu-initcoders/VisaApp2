'use client';

import { UnderlineField } from '@/components/apply/form/UnderlineField';
import { CorrectionGate } from '@/components/apply/form/CorrectionGate';
import {
  emptyTripDetails,
  toIsoDate,
  type TravellerTripDetails,
  type TripCopySource,
} from '@/lib/apply/applicationForm';
import {
  earliestFutureDateIso,
  futureDateError,
} from '@/lib/passport/schema';

interface TripDetailsTabProps {
  trip: TravellerTripDetails;
  countryName: string;
  tripSources?: TripCopySource[];
  onChange: (next: TravellerTripDetails) => void;
  editableKeys?: ReadonlySet<string>;
  comments?: Record<string, string>;
}

function updateTrip(
  trip: TravellerTripDetails,
  patch: Partial<TravellerTripDetails>
) {
  return emptyTripDetails({ ...trip, ...patch });
}

function FlightRouteSection({
  title,
  hint,
  flightNumber,
  date,
  dateLabel,
  numberKey,
  dateKey,
  editableKeys,
  comments,
  onChange,
}: {
  title: string;
  hint: string;
  flightNumber: string;
  date: string;
  dateLabel: string;
  numberKey: string;
  dateKey: string;
  editableKeys?: ReadonlySet<string>;
  comments?: Record<string, string>;
  onChange: (next: { flightNumber: string; date: string }) => void;
}) {
  const futureMin = earliestFutureDateIso();
  const numberLocked = Boolean(editableKeys && !editableKeys.has(numberKey));
  const dateLocked = Boolean(editableKeys && !editableKeys.has(dateKey));

  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-switzer text-sm font-semibold text-portrait-ink">
          {title}
        </h3>
        <p className="mt-1 text-sm text-slate-helper">{hint}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <CorrectionGate
          targetKey={numberKey}
          editableKeys={editableKeys}
          comment={comments?.[numberKey]}
        >
          <UnderlineField
            label="Flight number"
            required
            value={flightNumber}
            onChange={(value) => {
              if (numberLocked) return;
              onChange({
                flightNumber: value.toUpperCase(),
                date,
              });
            }}
          />
        </CorrectionGate>
        <CorrectionGate
          targetKey={dateKey}
          editableKeys={editableKeys}
          comment={comments?.[dateKey]}
        >
          <UnderlineField
            label={dateLabel}
            required
            type="date"
            min={futureMin}
            value={date}
            error={futureDateError(date || undefined)}
            onChange={(value) => {
              if (dateLocked) return;
              onChange({
                flightNumber,
                date: toIsoDate(value) || value,
              });
            }}
          />
        </CorrectionGate>
      </div>
    </section>
  );
}

export function TripDetailsTab({
  trip,
  countryName,
  tripSources = [],
  onChange,
  editableKeys,
  comments,
}: TripDetailsTabProps) {
  const futureMin = earliestFutureDateIso();
  const normalized = emptyTripDetails(trip);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="space-y-5">
        <div>
          <h2 className="font-basier text-xl text-portrait-ink">Trip details</h2>
          <p className="mt-1 text-sm text-slate-helper">
            Tell us when this traveller plans to enter and leave {countryName}.
            Visa type is already selected.
          </p>
          {tripSources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tripSources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  onClick={() =>
                    onChange(
                      emptyTripDetails({
                        ...source.tripDetails,
                        extra: normalized.extra,
                      })
                    )
                  }
                  className="inline-flex items-center rounded-full border border-ash bg-white px-3 py-1.5 text-sm text-nautical-teal hover:text-portrait-ink"
                >
                  Same as {source.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <CorrectionGate
            targetKey="trip.arrivalDate"
            editableKeys={editableKeys}
            comment={comments?.['trip.arrivalDate']}
          >
            <UnderlineField
              label="Intended arrival date"
              required
              type="date"
              min={futureMin}
              value={normalized.arrivalDate}
              error={futureDateError(normalized.arrivalDate || undefined)}
              onChange={(value) =>
                onChange(
                  updateTrip(normalized, {
                    arrivalDate: toIsoDate(value) || value,
                  })
                )
              }
            />
          </CorrectionGate>
          <CorrectionGate
            targetKey="trip.returnDate"
            editableKeys={editableKeys}
            comment={comments?.['trip.returnDate']}
          >
            <UnderlineField
              label="Intended return date"
              required
              type="date"
              min={futureMin}
              value={normalized.returnDate}
              error={
                futureDateError(normalized.returnDate || undefined) ||
                (normalized.arrivalDate &&
                normalized.returnDate &&
                normalized.returnDate < normalized.arrivalDate
                  ? 'Return date should be on or after arrival'
                  : null)
              }
              onChange={(value) =>
                onChange(
                  updateTrip(normalized, {
                    returnDate: toIsoDate(value) || value,
                  })
                )
              }
            />
          </CorrectionGate>
        </div>
      </div>

      <FlightRouteSection
        title="Arrival flight details"
        hint="The flight number that arrives into the destination country."
        flightNumber={normalized.flightNumber}
        date={normalized.arrivalFlightDate}
        dateLabel="Arrival date"
        numberKey="trip.flightNumber"
        dateKey="trip.arrivalFlightDate"
        editableKeys={editableKeys}
        comments={comments}
        onChange={({ flightNumber, date }) =>
          onChange(
            updateTrip(normalized, {
              arrivalFlightMode: 'direct',
              flightNumber,
              arrivalFlightDate: date,
              arrivalFlights: [{ flightNumber, date }],
            })
          )
        }
      />

      <FlightRouteSection
        title="Return flight details"
        hint="The flight number that departs from the destination country."
        flightNumber={normalized.returnFlightNumber}
        date={normalized.returnFlightDate}
        dateLabel="Departure date"
        numberKey="trip.returnFlightNumber"
        dateKey="trip.returnFlightDate"
        editableKeys={editableKeys}
        comments={comments}
        onChange={({ flightNumber, date }) =>
          onChange(
            updateTrip(normalized, {
              returnFlightMode: 'direct',
              returnFlightNumber: flightNumber,
              returnFlightDate: date,
              returnFlights: [{ flightNumber, date }],
            })
          )
        }
      />

      <section className="space-y-5">
        <div>
          <h3 className="font-switzer text-sm font-semibold text-portrait-ink">
            Hotel details
          </h3>
          <p className="mt-1 text-sm text-slate-helper">
            Where this traveller will stay after arrival.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <CorrectionGate
            targetKey="trip.accommodationName"
            editableKeys={editableKeys}
            comment={comments?.['trip.accommodationName']}
          >
            <UnderlineField
              label="Hotel / accommodation name"
              value={normalized.accommodationName}
              onChange={(value) =>
                onChange(updateTrip(normalized, { accommodationName: value }))
              }
            />
          </CorrectionGate>
          <CorrectionGate
            targetKey="trip.arrivalCity"
            editableKeys={editableKeys}
            comment={comments?.['trip.arrivalCity']}
          >
            <UnderlineField
              label="Arrival city / port of entry"
              value={normalized.arrivalCity}
              onChange={(value) =>
                onChange(updateTrip(normalized, { arrivalCity: value }))
              }
            />
          </CorrectionGate>
          <div className="sm:col-span-2">
            <CorrectionGate
              targetKey="trip.accommodationAddress"
              editableKeys={editableKeys}
              comment={comments?.['trip.accommodationAddress']}
            >
              <UnderlineField
                label="Stay address"
                value={normalized.accommodationAddress}
                onChange={(value) =>
                  onChange(
                    updateTrip(normalized, { accommodationAddress: value })
                  )
                }
              />
            </CorrectionGate>
          </div>
        </div>
      </section>
    </div>
  );
}
