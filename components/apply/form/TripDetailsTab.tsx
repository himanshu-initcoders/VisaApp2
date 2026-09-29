'use client';

import { Plus, Trash2 } from 'lucide-react';
import { AnimatedTabs } from '@/components/ui';
import { UnderlineField } from '@/components/apply/form/UnderlineField';
import {
  emptyTripDetails,
  toIsoDate,
  type FlightLeg,
  type FlightStopMode,
  type TravellerTripDetails,
} from '@/lib/apply/applicationForm';
import {
  earliestFutureDateIso,
  futureDateError,
} from '@/lib/passport/schema';

interface TripDetailsTabProps {
  trip: TravellerTripDetails;
  countryName: string;
  onChange: (next: TravellerTripDetails) => void;
}

const FLIGHT_MODES = [
  { id: 'direct', label: 'Direct flight' },
  { id: 'multistop', label: 'Multi stop' },
] as const;

function updateTrip(
  trip: TravellerTripDetails,
  patch: Partial<TravellerTripDetails>
) {
  return emptyTripDetails({ ...trip, ...patch });
}

function FlightRouteSection({
  title,
  hint,
  mode,
  legs,
  dateLabel,
  layoutId,
  onChange,
}: {
  title: string;
  hint: string;
  mode: FlightStopMode;
  legs: FlightLeg[];
  dateLabel: string;
  layoutId: string;
  onChange: (next: { mode: FlightStopMode; legs: FlightLeg[] }) => void;
}) {
  const futureMin = earliestFutureDateIso();
  const shown = mode === 'direct' ? legs.slice(0, 1) : legs;

  const setLeg = (index: number, patch: Partial<FlightLeg>) => {
    const next = legs.map((leg, legIndex) =>
      legIndex === index ? { ...leg, ...patch } : leg
    );
    onChange({ mode, legs: next });
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-switzer text-sm font-semibold text-portrait-ink">
          {title}
        </h3>
        <p className="mt-1 text-sm text-slate-helper">{hint}</p>
      </div>

      <AnimatedTabs
        items={[...FLIGHT_MODES]}
        value={mode}
        onChange={(id) =>
          onChange({
            mode: id as FlightStopMode,
            legs,
          })
        }
        tone="light"
        layoutId={layoutId}
        ariaLabel={title}
      />

      <div className="space-y-4">
        {shown.map((leg, index) => (
          <div
            key={`${mode}-${index}`}
            className="grid gap-5 sm:grid-cols-2"
          >
            {mode === 'multistop' && (
              <p className="sm:col-span-2 font-switzer text-xs font-semibold uppercase tracking-[0.12em] text-slate-helper">
                Flight {index + 1}
              </p>
            )}
            <UnderlineField
              label="Flight number"
              required
              value={leg.flightNumber}
              onChange={(value) =>
                setLeg(index, { flightNumber: value.toUpperCase() })
              }
            />
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <UnderlineField
                  label={dateLabel}
                  required
                  type="date"
                  min={futureMin}
                  value={leg.date}
                  error={futureDateError(leg.date || undefined)}
                  onChange={(value) =>
                    setLeg(index, { date: toIsoDate(value) || value })
                  }
                />
              </div>
              {mode === 'multistop' && shown.length > 2 && (
                <button
                  type="button"
                  aria-label={`Remove flight ${index + 1}`}
                  onClick={() =>
                    onChange({
                      mode,
                      legs: legs.filter((_, legIndex) => legIndex !== index),
                    })
                  }
                  className="mb-2 rounded-full p-2 text-slate-helper hover:bg-peach-wash hover:text-[#ff4940]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {mode === 'multistop' && (
        <button
          type="button"
          onClick={() =>
            onChange({
              mode,
              legs: [...legs, { flightNumber: '', date: '' }],
            })
          }
          className="inline-flex items-center gap-1.5 rounded-full border border-ash bg-white px-3 py-1.5 text-sm text-nautical-teal hover:text-portrait-ink"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another flight
        </button>
      )}
    </section>
  );
}

export function TripDetailsTab({
  trip,
  countryName,
  onChange,
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
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
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
        </div>
      </div>

      <FlightRouteSection
        title="Arrival flight details"
        hint="The flight that arrives in the country."
        mode={normalized.arrivalFlightMode}
        legs={normalized.arrivalFlights}
        dateLabel="Arrival date"
        layoutId="arrival-flight-mode"
        onChange={({ mode, legs }) =>
          onChange(
            updateTrip(normalized, {
              arrivalFlightMode: mode,
              arrivalFlights: legs,
            })
          )
        }
      />

      <FlightRouteSection
        title="Return flight details"
        hint="The flight that brings this traveller back."
        mode={normalized.returnFlightMode}
        legs={normalized.returnFlights}
        dateLabel="Departure date"
        layoutId="return-flight-mode"
        onChange={({ mode, legs }) =>
          onChange(
            updateTrip(normalized, {
              returnFlightMode: mode,
              returnFlights: legs,
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
          <UnderlineField
            label="Hotel / accommodation name"
            value={normalized.accommodationName}
            onChange={(value) =>
              onChange(updateTrip(normalized, { accommodationName: value }))
            }
          />
          <UnderlineField
            label="Arrival city / port of entry"
            value={normalized.arrivalCity}
            onChange={(value) =>
              onChange(updateTrip(normalized, { arrivalCity: value }))
            }
          />
          <div className="sm:col-span-2">
            <UnderlineField
              label="Stay address"
              value={normalized.accommodationAddress}
              onChange={(value) =>
                onChange(
                  updateTrip(normalized, { accommodationAddress: value })
                )
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}
