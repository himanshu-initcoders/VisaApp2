'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Pencil, X } from 'lucide-react';
import type { IndianPassportFields } from '@/lib/passport/types';
import { isReviewComplete } from '@/lib/passport/schema';

interface PassportReviewStageProps {
  initial: IndianPassportFields & {
    frontPreviewUrl: string;
    backPreviewUrl?: string;
    warnings?: string[];
  };
  onBack: () => void;
  onClose: () => void;
  onEditFront: () => void;
  onContinue: (data: IndianPassportFields) => void;
}

function isoToDisplay(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function displayToIso(display: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(display)) return display;
  const parsed = Date.parse(display);
  if (Number.isNaN(parsed)) return display;
  const date = new Date(parsed);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function UnderlineField({
  label,
  value,
  onChange,
  required,
  type = 'text',
  trailing,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
        {label}
        {required && <span className="text-[#ff4940]"> *</span>}
      </span>
      <div className="relative mt-1 flex items-end gap-2 border-b border-ash pb-2">
        {trailing}
        <input
          type={type}
          value={value}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-base text-portrait-ink outline-none"
        />
      </div>
    </label>
  );
}

export function PassportReviewStage({
  initial,
  onBack,
  onClose,
  onEditFront,
  onContinue,
}: PassportReviewStageProps) {
  const [form, setForm] = useState<IndianPassportFields>({
    passportNumber: initial.passportNumber,
    surname: initial.surname,
    givenNames: initial.givenNames,
    nationality: initial.nationality || 'IND',
    dateOfBirth: initial.dateOfBirth,
    sex: initial.sex,
    dateOfExpiry: initial.dateOfExpiry,
    documentType: initial.documentType || 'P',
    countryOfIssue: initial.countryOfIssue || 'IND',
    fathersName: initial.fathersName || '',
    mothersName: initial.mothersName || '',
    spouseName: initial.spouseName || '',
    dateOfIssue: initial.dateOfIssue || '',
    placeOfBirth: initial.placeOfBirth || '',
    placeOfIssue: initial.placeOfIssue || '',
    address: initial.address || '',
    fileNumber: initial.fileNumber || '',
    oldPassportNumber: initial.oldPassportNumber || '',
    oldPassportDateOfIssue: initial.oldPassportDateOfIssue || '',
    oldPassportPlaceOfIssue: initial.oldPassportPlaceOfIssue || '',
    email: initial.email || '',
    phone: initial.phone || '',
  });

  const canContinue = useMemo(() => isReviewComplete(form), [form]);

  const set =
    (key: keyof IndianPassportFields) =>
    (value: string) => {
      setForm((current) => ({
        ...current,
        [key]:
          key === 'email' || key === 'phone'
            ? value
            : key === 'sex'
              ? (value as IndianPassportFields['sex'])
              : value.toUpperCase(),
      }));
    };

  return (
    <div className="min-h-dvh bg-white">
      <header className="relative flex items-center justify-between px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-ash bg-white px-3 py-1.5 text-sm text-portrait-ink shadow-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <h1 className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-basier text-xl text-portrait-ink sm:text-2xl">
          Review passport details
        </h1>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded-full border border-ash p-2 text-slate-helper hover:text-portrait-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {(initial.warnings?.length ?? 0) > 0 && (
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="rounded-2xl border border-peach-wash bg-peach-wash/60 px-4 py-2 text-xs text-portrait-ink">
            {initial.warnings?.join(' · ')}
          </p>
        </div>
      )}

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 sm:px-6 sm:py-8">
        <div className="space-y-4 rounded-[24px] border border-ash bg-[#f8fafc] p-4">
          <div className="relative overflow-hidden rounded-2xl bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={initial.frontPreviewUrl}
              alt="Passport front"
              className="w-full object-contain"
            />
            <button
              type="button"
              aria-label="Re-upload front"
              onClick={onEditFront}
              className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#3b82f6] text-white shadow-md"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
          {initial.backPreviewUrl && (
            <div className="relative overflow-hidden rounded-2xl bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={initial.backPreviewUrl}
                alt="Passport back"
                className="w-full object-contain"
              />
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <UnderlineField
              label="First name"
              required
              value={form.givenNames}
              onChange={set('givenNames')}
            />
            <UnderlineField
              label="Last name"
              required
              value={form.surname}
              onChange={set('surname')}
            />
            <UnderlineField
              label="Father's name"
              value={form.fathersName || ''}
              onChange={set('fathersName')}
            />
            <UnderlineField
              label="Mother's name"
              value={form.mothersName || ''}
              onChange={set('mothersName')}
            />
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
                Gender <span className="text-[#ff4940]">*</span>
              </span>
              <div className="relative mt-1 border-b border-ash pb-2">
                <select
                  value={form.sex}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sex: event.target.value as IndianPassportFields['sex'],
                    }))
                  }
                  className="w-full appearance-none bg-transparent text-base text-portrait-ink outline-none"
                >
                  <option value="">Select</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="X">Other</option>
                </select>
              </div>
            </label>
            <UnderlineField
              label="Passport number"
              required
              value={form.passportNumber}
              onChange={set('passportNumber')}
            />
            <UnderlineField
              label="Date of birth"
              required
              value={isoToDisplay(form.dateOfBirth)}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  dateOfBirth: displayToIso(value),
                }))
              }
            />
            <UnderlineField
              label="Passport issued on"
              value={form.dateOfIssue ? isoToDisplay(form.dateOfIssue) : ''}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  dateOfIssue: displayToIso(value),
                }))
              }
            />
            <UnderlineField
              label="Passport valid till"
              required
              value={isoToDisplay(form.dateOfExpiry)}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  dateOfExpiry: displayToIso(value),
                }))
              }
            />
            <UnderlineField
              label="Place of birth"
              value={form.placeOfBirth || ''}
              onChange={set('placeOfBirth')}
            />
            <UnderlineField
              label="Place of issue"
              value={form.placeOfIssue || ''}
              onChange={set('placeOfIssue')}
            />
            <UnderlineField
              label="Nationality"
              value={form.nationality || ''}
              onChange={set('nationality')}
            />
            <UnderlineField
              label="Spouse's name"
              value={form.spouseName || ''}
              onChange={set('spouseName')}
            />
          </div>

          <div className="pt-4">
            <h2 className="font-basier text-xl text-portrait-ink">
              Address &amp; Previous Passport
            </h2>
            <p className="mt-1 text-sm text-slate-helper">
              Read from the back page of your passport.
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <UnderlineField
                  label="Address"
                  value={form.address || ''}
                  onChange={set('address')}
                />
              </div>
              <UnderlineField
                label="File number"
                value={form.fileNumber || ''}
                onChange={set('fileNumber')}
              />
              <UnderlineField
                label="Old passport number"
                value={form.oldPassportNumber || ''}
                onChange={set('oldPassportNumber')}
              />
              <UnderlineField
                label="Old passport issued on"
                value={
                  form.oldPassportDateOfIssue
                    ? isoToDisplay(form.oldPassportDateOfIssue)
                    : ''
                }
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    oldPassportDateOfIssue: displayToIso(value),
                  }))
                }
              />
              <UnderlineField
                label="Old passport place of issue"
                value={form.oldPassportPlaceOfIssue || ''}
                onChange={set('oldPassportPlaceOfIssue')}
              />
            </div>
          </div>

          <div className="pt-4">
            <h2 className="font-basier text-xl text-portrait-ink">
              Contact Details
            </h2>
            <p className="mt-1 text-sm text-slate-helper">
              Required for sharing essential visa updates. In real time.
            </p>
            <div className="mt-5 space-y-5">
              <UnderlineField
                label="Email address"
                required
                type="email"
                value={form.email || ''}
                onChange={(value) =>
                  setForm((current) => ({ ...current, email: value }))
                }
              />
              <UnderlineField
                label="Phone number"
                required
                value={form.phone || ''}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    phone: value.replace(/\D/g, '').slice(0, 10),
                  }))
                }
                trailing={
                  <span className="flex shrink-0 items-center gap-1.5 text-sm text-portrait-ink">
                    <span className="rounded bg-sky-wash px-1.5 py-0.5 text-[10px] font-semibold">
                      IN
                    </span>
                    +91
                  </span>
                }
              />
            </div>
          </div>

          <button
            type="button"
            disabled={!canContinue}
            onClick={() => onContinue(form)}
            className="mt-6 w-full rounded-full bg-[#e8eaed] px-6 py-3.5 text-base font-semibold text-portrait-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
