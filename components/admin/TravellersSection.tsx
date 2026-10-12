'use client';

import { useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  InitialTabs,
  Badge,
  getStatusVariant,
} from '@/components/ui';
import type { ApplyFormConfig } from '@/lib/apply/applicationForm';
import {
  formatExtraAnswer,
  formatReviewDate,
  formatReviewValue,
  listSubmittedExtraAnswers,
} from '@/lib/apply/reviewFields';
import type { IndianPassportFields } from '@/lib/passport/types';
import {
  travellerKey,
  useTravellerSelectionOptional,
} from '@/components/admin/TravellerSelectionContext';
import { StaffFieldEditDialog } from '@/components/admin/StaffFieldEditDialog';
import type { StaffEditableTarget } from '@/lib/visa/staffFields';

export type AdminStoredTraveller = {
  passengerId?: string;
  name?: string;
  /** visa_application_travellers.id */
  travellerRowId?: string;
  status?: string;
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
  applicationId?: string;
  travellers: AdminStoredTraveller[];
  snapshot: ApplyFormConfig | null;
  editors?: StaffEditableTarget[];
  /** False for draft applications and the applicant view. */
  editingEnabled?: boolean;
}

interface OpenEdit {
  editor: StaffEditableTarget;
  travellerId: string;
  currentRaw: string;
  currentDisplay: string;
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
  onEdit,
}: {
  label: string;
  value: React.ReactNode;
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <dt className="mb-1 font-switzer text-xs text-slate-helper">{label}</dt>
        <dd className="break-words font-switzer text-sm text-portrait-ink">
          {value || '—'}
        </dd>
      </div>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${label}`}
          className="mt-0.5 shrink-0 rounded-full p-1 text-nautical-teal hover:text-portrait-ink"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function rawFieldValue(
  traveller: AdminStoredTraveller,
  targetKey: string
): string {
  if (targetKey.startsWith('passport.')) {
    const value = traveller.passportData?.[targetKey.slice('passport.'.length)];
    return value == null ? '' : String(value);
  }
  if (targetKey.startsWith('trip.')) {
    const field = targetKey.slice('trip.'.length);
    const value = traveller.tripDetails?.[field];
    const text = value == null ? '' : String(value);
    if (text) return text;
    const legKey =
      field === 'flightNumber' || field === 'arrivalFlightDate'
        ? 'arrivalFlights'
        : field === 'returnFlightNumber' || field === 'returnFlightDate'
          ? 'returnFlights'
          : null;
    if (!legKey) return '';
    const legs = traveller.tripDetails?.[legKey];
    const leg =
      Array.isArray(legs) && legs[0] && typeof legs[0] === 'object'
        ? (legs[0] as { flightNumber?: string; date?: string })
        : null;
    if (!leg) return '';
    if (field === 'flightNumber' || field === 'returnFlightNumber') {
      return leg.flightNumber ? String(leg.flightNumber) : '';
    }
    return leg.date ? String(leg.date) : '';
  }
  if (targetKey.startsWith('extra.')) {
    const extra = traveller.tripDetails?.extra;
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return '';
    const value = (extra as Record<string, unknown>)[
      targetKey.slice('extra.'.length)
    ];
    return typeof value === 'string' ? value : value == null ? '' : String(value);
  }
  const doc = (traveller.documents ?? []).find((item) => item.slotKey === targetKey);
  return doc?.filename || '';
}

function displayFor(
  snapshot: ApplyFormConfig | null,
  editor: StaffEditableTarget,
  raw: string
): string {
  if (editor.control.input === 'file') return raw || 'Not uploaded';
  if (!raw) return '—';
  if (editor.targetKey.startsWith('passport.')) {
    const field = editor.targetKey.slice('passport.'.length);
    return formatReviewValue(field as keyof IndianPassportFields, raw) || raw;
  }
  if (editor.targetKey.startsWith('trip.') && editor.control.input === 'date') {
    return formatReviewDate(raw);
  }
  if (editor.targetKey.startsWith('extra.')) {
    const question = snapshot?.extraQuestions?.find(
      (item) => item.key === editor.targetKey.slice('extra.'.length)
    );
    return formatExtraAnswer(question, raw) || '—';
  }
  return raw;
}

function flightLine(
  legs: unknown,
  number: unknown,
  date: unknown
): string {
  if (Array.isArray(legs) && legs.length > 0) {
    return (
      legs
        .map((leg: { flightNumber?: string; date?: string }) =>
          [leg.flightNumber, leg.date].filter(Boolean).join(' · ')
        )
        .filter(Boolean)
        .join(' → ') || '—'
    );
  }
  if (number) {
    return `${String(number)}${date ? ` · ${String(date)}` : ''}`;
  }
  return '—';
}

function routeSummary(
  legs: unknown
): string | null {
  if (!Array.isArray(legs) || legs.length < 2) return null;
  const text = legs
    .map((leg: { flightNumber?: string; date?: string }) =>
      [leg.flightNumber, leg.date].filter(Boolean).join(' · ')
    )
    .filter(Boolean)
    .join(' → ');
  return text || null;
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
  applicationId = '',
  travellers,
  snapshot,
  editors = [],
  editingEnabled = false,
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
  const [openEdit, setOpenEdit] = useState<OpenEdit | null>(null);
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
  const extraRows = listSubmittedExtraAnswers(
    snapshot?.extraQuestions ?? [],
    extra
  );
  const canEdit =
    editingEnabled &&
    Boolean(traveller.travellerRowId) &&
    traveller.status !== 'approved' &&
    traveller.status !== 'rejected';
  const passportEditors = editors.filter(
    (editor) => editor.kind === 'field' && editor.targetKey.startsWith('passport.')
  );
  const tripEditors = editors.filter(
    (editor) => editor.kind === 'field' && editor.targetKey.startsWith('trip.')
  );
  const extraEditors = editors.filter(
    (editor) => editor.kind === 'field' && editor.targetKey.startsWith('extra.')
  );
  const documentEditors = editors.filter((editor) => editor.kind === 'document');
  const knownPassport = new Set(
    passportEditors.map((editor) => editor.targetKey.slice('passport.'.length))
  );
  const knownExtra = new Set(
    extraEditors.map((editor) => editor.targetKey.slice('extra.'.length))
  );
  const editedExtraRowKeys = new Set(
    (snapshot?.extraQuestions ?? []).flatMap((question) =>
      knownExtra.has(question.key) ? [question.key, question.id] : []
    )
  );
  const knownSlots = new Set(documentEditors.map((editor) => editor.targetKey));
  const leftoverPassport = Object.entries(passport).filter(
    ([key]) => !knownPassport.has(key)
  );
  const leftoverExtra = extraRows.filter(
    (row) => !editedExtraRowKeys.has(row.key)
  );
  const extraDocs = (traveller.documents ?? []).filter(
    (doc) => !doc.slotKey || !knownSlots.has(doc.slotKey)
  );
  const uploadedSlotKeys = new Set(
    (traveller.documents ?? []).map((doc) => doc.slotKey).filter(Boolean)
  );
  const missingSlots =
    documentEditors.length === 0
      ? (snapshot?.documentSlots ?? []).filter(
          (slot) => slot.required === false && !uploadedSlotKeys.has(slot.key)
        )
      : [];
  const arrivalRoute = routeSummary(trip.arrivalFlights);
  const returnRoute = routeSummary(trip.returnFlights);

  const editFor = (editor: StaffEditableTarget) => {
    if (!canEdit || !traveller.travellerRowId) return undefined;
    return () => {
      const currentRaw = rawFieldValue(traveller, editor.targetKey);
      setOpenEdit({
        editor,
        travellerId: traveller.travellerRowId!,
        currentRaw,
        currentDisplay: displayFor(snapshot, editor, currentRaw),
      });
    };
  };

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>
              Traveller {index + 1}
              {traveller.name ? `: ${traveller.name}` : ''}
            </CardTitle>
            {traveller.status ? (
              <Badge variant={getStatusVariant(traveller.status)}>
                {traveller.status.replace(/_/g, ' ')}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-3 font-switzer text-sm font-semibold text-portrait-ink">
              Passport / general
            </h3>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {passportEditors.length === 0 && leftoverPassport.length === 0 ? (
                <Field label="Passport" value="Not provided" />
              ) : (
                <>
                  {passportEditors.map((editor) => {
                    const raw = rawFieldValue(traveller, editor.targetKey);
                    return (
                      <Field
                        key={editor.targetKey}
                        label={editor.label}
                        value={displayFor(snapshot, editor, raw)}
                        onEdit={editFor(editor)}
                      />
                    );
                  })}
                  {leftoverPassport.map(([key, value]) => (
                    <Field
                      key={key}
                      label={key}
                      value={value == null || value === '' ? '—' : String(value)}
                    />
                  ))}
                </>
              )}
            </dl>
          </div>

          <div>
              <h3 className="mb-3 font-switzer text-sm font-semibold text-portrait-ink">
                Trip details
              </h3>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {tripEditors.length > 0 ? (
                  tripEditors.map((editor) => {
                    const raw = rawFieldValue(traveller, editor.targetKey);
                    return (
                      <Field
                        key={editor.targetKey}
                        label={editor.label}
                        value={displayFor(snapshot, editor, raw)}
                        onEdit={editFor(editor)}
                      />
                    );
                  })
                ) : (
                  <>
                    <Field
                      label="Arrival"
                      value={
                        trip.arrivalDate
                          ? formatReviewDate(String(trip.arrivalDate))
                          : '—'
                      }
                    />
                    <Field
                      label="Return"
                      value={
                        trip.returnDate
                          ? formatReviewDate(String(trip.returnDate))
                          : '—'
                      }
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
                      value={flightLine(
                        trip.arrivalFlights,
                        trip.flightNumber,
                        trip.arrivalFlightDate
                      )}
                    />
                    <Field
                      label="Return flight"
                      value={flightLine(
                        trip.returnFlights,
                        trip.returnFlightNumber,
                        trip.returnFlightDate
                      )}
                    />
                  </>
                )}
                {arrivalRoute ? (
                  <Field label="Full arrival route" value={arrivalRoute} />
                ) : null}
                {returnRoute ? (
                  <Field label="Full return route" value={returnRoute} />
                ) : null}
              </dl>
            </div>

          {(extraEditors.length > 0 || leftoverExtra.length > 0) && (
            <div>
              <h3 className="mb-3 font-switzer text-sm font-semibold text-portrait-ink">
                Additional answers
              </h3>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {extraEditors.map((editor) => {
                  const raw = rawFieldValue(traveller, editor.targetKey);
                  return (
                    <Field
                      key={editor.targetKey}
                      label={editor.label}
                      value={displayFor(snapshot, editor, raw)}
                      onEdit={editFor(editor)}
                    />
                  );
                })}
                {leftoverExtra.map((row) => (
                  <Field key={row.key} label={row.label} value={row.value} />
                ))}
              </dl>
            </div>
          )}

          {(documentEditors.length > 0 ||
            extraDocs.length > 0 ||
            missingSlots.length > 0) && (
            <div>
              <h3 className="mb-3 font-switzer text-sm font-semibold text-portrait-ink">
                Documents
              </h3>
              <ul className="space-y-2">
                {documentEditors.map((editor) => {
                  const doc = (traveller.documents ?? []).find(
                    (item) => item.slotKey === editor.targetKey
                  );
                  return (
                    <li
                      key={editor.targetKey}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-ash px-3 py-2"
                    >
                      <span className="font-switzer text-sm text-portrait-ink">
                        {editor.label}
                        {doc?.filename ? ` · ${doc.filename}` : ''}
                        {!doc ? (
                          <span className="italic text-slate-helper">
                            {' '}
                            · Not uploaded
                          </span>
                        ) : null}
                      </span>
                      <span className="flex items-center gap-2">
                        {doc?.url ? (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-nautical-teal hover:text-portrait-ink"
                          >
                            Open
                          </a>
                        ) : null}
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={editFor(editor)}
                            aria-label={`Edit ${editor.label}`}
                            className="rounded-full p-1 text-nautical-teal hover:text-portrait-ink"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
                {missingSlots.map((slot) => (
                  <li
                    key={`missing-${slot.key}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-ash px-3 py-2"
                  >
                    <span className="font-switzer text-sm text-portrait-ink">
                      {slot.title || labelForDocSlot(snapshot, slot.key)}
                    </span>
                    <span className="font-switzer text-sm italic text-slate-helper">
                      Not uploaded
                    </span>
                  </li>
                ))}
                {extraDocs.map((doc, docIdx) => (
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
      {openEdit ? (
        <StaffFieldEditDialog
          isOpen
          onClose={() => setOpenEdit(null)}
          applicationId={applicationId}
          travellerId={openEdit.travellerId}
          editor={openEdit.editor}
          currentRaw={openEdit.currentRaw}
          currentDisplay={openEdit.currentDisplay}
        />
      ) : null}
    </div>
  );
}
