'use client';

import { useMemo, useState } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  InitialTabs,
} from '@/components/ui';
import type {
  ApplyFormConfig,
  ApplyTripQuestion,
} from '@/lib/apply/applicationForm';
import { formatExtraAnswer } from '@/lib/apply/reviewFields';
import {
  travellerKey,
  useTravellerSelectionOptional,
} from '@/components/admin/TravellerSelectionContext';

export type AdminStoredTraveller = {
  passengerId?: string;
  name?: string;
  passportData?: Record<string, unknown> | null;
  tripDetails?: Record<string, unknown> | null;
  documents?: Array<{
    slotKey?: string;
    key?: string;
    url?: string;
    mimeType?: string;
    filename?: string;
  }>;
};

interface TravellersSectionProps {
  travellers: AdminStoredTraveller[];
  snapshot: ApplyFormConfig | null;
}

function questionForAnswer(
  snapshot: ApplyFormConfig | null,
  key: string
): ApplyTripQuestion | undefined {
  return snapshot?.extraQuestions?.find(
    (item) => item.key === key || item.id === key
  );
}

function labelForDocSlot(
  snapshot: ApplyFormConfig | null,
  slotKey: string
): string {
  const slot = snapshot?.documentSlots?.find((item) => item.key === slotKey);
  if (slot?.title) return slot.title;
  if (slotKey === 'passport-front') return 'Passport front';
  if (slotKey === 'passport-back') return 'Passport back';
  return slotKey;
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="mb-1 font-switzer text-xs text-slate-helper">{label}</dt>
      <dd className="break-words font-switzer text-sm text-portrait-ink">
        {value || '—'}
      </dd>
    </div>
  );
}

function travellerId(traveller: AdminStoredTraveller, index: number): string {
  return travellerKey(traveller, index);
}

function travellerLabel(traveller: AdminStoredTraveller, index: number): string {
  const name = traveller.name?.trim();
  if (name) return name;
  return `Traveller ${index + 1}`;
}

/**
 * Multi-traveller viewer with first-letter circle tabs to avoid long scrolls.
 * Syncs selection with TravellerSelectionProvider when present (filters sidebar docs).
 */
export function TravellersSection({
  travellers,
  snapshot,
}: TravellersSectionProps) {
  const selection = useTravellerSelectionOptional();

  const items = useMemo(
    () =>
      travellers.map((t, index) => ({
        id: travellerId(t, index),
        label: travellerLabel(t, index),
      })),
    [travellers]
  );

  const [localActiveId, setLocalActiveId] = useState(items[0]?.id ?? '');
  const activeId = selection?.activeTravellerId ?? localActiveId;
  const setActiveId = selection?.setActiveTravellerId ?? setLocalActiveId;

  const activeIndex = Math.max(
    0,
    travellers.findIndex((t, i) => travellerId(t, i) === activeId)
  );
  const traveller = travellers[activeIndex] ?? travellers[0];
  if (!traveller) return null;

  const index = activeIndex;
  const passport = traveller.passportData || {};
  const trip = traveller.tripDetails || {};
  const extra = (trip.extra as Record<string, string> | undefined) || {};

  return (
    <div className="space-y-4">
      {items.length > 1 && (
        <InitialTabs
          items={items}
          value={activeId || items[0].id}
          onChange={setActiveId}
          ariaLabel="Select traveller"
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Traveller {index + 1}
            {traveller.name ? `: ${traveller.name}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-3 font-switzer text-sm font-semibold text-portrait-ink">
              Passport / general
            </h3>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Object.keys(passport).length === 0 ? (
                <Field label="Passport" value="Not provided" />
              ) : (
                Object.entries(passport).map(([key, value]) => (
                  <Field
                    key={key}
                    label={key}
                    value={
                      value == null || value === '' ? '—' : String(value)
                    }
                  />
                ))
              )}
            </dl>
          </div>

          <div>
            <h3 className="mb-3 font-switzer text-sm font-semibold text-portrait-ink">
              Trip details
            </h3>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Arrival"
                value={trip.arrivalDate ? String(trip.arrivalDate) : '—'}
              />
              <Field
                label="Return"
                value={trip.returnDate ? String(trip.returnDate) : '—'}
              />
              <Field
                label="Arrival city"
                value={trip.arrivalCity ? String(trip.arrivalCity) : '—'}
              />
              <Field
                label="Accommodation"
                value={
                  trip.accommodationName
                    ? String(trip.accommodationName)
                    : '—'
                }
              />
              <Field
                label="Address"
                value={
                  trip.accommodationAddress
                    ? String(trip.accommodationAddress)
                    : '—'
                }
              />
              <Field
                label="Arrival flight"
                value={
                  Array.isArray(trip.arrivalFlights) &&
                  trip.arrivalFlights.length > 0
                    ? trip.arrivalFlights
                        .map((leg: { flightNumber?: string; date?: string }) =>
                          [leg.flightNumber, leg.date].filter(Boolean).join(' · ')
                        )
                        .filter(Boolean)
                        .join(' → ') || '—'
                    : trip.flightNumber
                      ? `${String(trip.flightNumber)}${
                          trip.arrivalFlightDate
                            ? ` · ${String(trip.arrivalFlightDate)}`
                            : ''
                        }`
                      : '—'
                }
              />
              <Field
                label="Return flight"
                value={
                  Array.isArray(trip.returnFlights) &&
                  trip.returnFlights.length > 0
                    ? trip.returnFlights
                        .map((leg: { flightNumber?: string; date?: string }) =>
                          [leg.flightNumber, leg.date].filter(Boolean).join(' · ')
                        )
                        .filter(Boolean)
                        .join(' → ') || '—'
                    : trip.returnFlightNumber
                      ? `${String(trip.returnFlightNumber)}${
                          trip.returnFlightDate
                            ? ` · ${String(trip.returnFlightDate)}`
                            : ''
                        }`
                      : '—'
                }
              />
            </dl>
          </div>

          {Object.keys(extra).length > 0 && (
            <div>
              <h3 className="mb-3 font-switzer text-sm font-semibold text-portrait-ink">
                Additional answers
              </h3>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Object.entries(extra).map(([key, value]) => {
                  const question = questionForAnswer(snapshot, key);
                  return (
                    <Field
                      key={key}
                      label={question?.label || key}
                      value={formatExtraAnswer(question, value) || '—'}
                    />
                  );
                })}
              </dl>
            </div>
          )}

          {(traveller.documents?.length ?? 0) > 0 && (
            <div>
              <h3 className="mb-3 font-switzer text-sm font-semibold text-portrait-ink">
                Documents
              </h3>
              <ul className="space-y-2">
                {traveller.documents!.map((doc, docIdx) => (
                  <li
                    key={`${doc.slotKey}-${docIdx}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-ash px-3 py-2"
                  >
                    <span className="font-switzer text-sm text-portrait-ink">
                      {labelForDocSlot(snapshot, doc.slotKey || 'document')}
                      {doc.filename ? ` · ${doc.filename}` : ''}
                    </span>
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-nautical-teal hover:text-portrait-ink"
                      >
                        Open
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
