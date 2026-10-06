'use client';

import { Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  UnderlineField,
  UnderlineSelect,
  displayToIso,
} from '@/components/apply/form/UnderlineField';
import { CorrectionGate } from '@/components/apply/form/CorrectionGate';
import type { IndianPassportFields } from '@/lib/passport/types';
import {
  earliestFutureDateIso,
  futureDateError,
  latestPastDateIso,
  pastDateError,
} from '@/lib/passport/schema';

interface GeneralDetailsTabProps {
  form: IndianPassportFields;
  onChange: (next: IndianPassportFields) => void;
  frontPreviewUrl: string;
  backPreviewUrl?: string;
  warnings?: string[];
  onEditFront: () => void;
  onEditBack?: () => void;
  /** When set, only these `passport.*` and passport image keys stay editable. */
  editableKeys?: ReadonlySet<string>;
  comments?: Record<string, string>;
}

/** Native date inputs need YYYY-MM-DD; OCR/draft values are usually already ISO. */
function toDateInputValue(value: string | undefined): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const iso = displayToIso(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : '';
}

export function GeneralDetailsTab({
  form,
  onChange,
  frontPreviewUrl,
  backPreviewUrl,
  warnings,
  onEditFront,
  onEditBack,
  editableKeys,
  comments,
}: GeneralDetailsTabProps) {
  const pastMax = latestPastDateIso();
  const futureMin = earliestFutureDateIso();
  const frontLocked = Boolean(editableKeys && !editableKeys.has('passport-front'));
  const backLocked = Boolean(editableKeys && !editableKeys.has('passport-back'));

  const set =
    (key: keyof IndianPassportFields) =>
    (value: string) => {
      if (editableKeys && !editableKeys.has(`passport.${key}`)) return;
      onChange({
        ...form,
        [key]:
          key === 'email' || key === 'phone'
            ? value
            : key === 'sex'
              ? (value as IndianPassportFields['sex'])
              : value.toUpperCase(),
      });
    };

  const gate = (field: string, node: ReactNode) => (
    <CorrectionGate
      targetKey={`passport.${field}`}
      editableKeys={editableKeys}
      comment={comments?.[`passport.${field}`]}
    >
      {node}
    </CorrectionGate>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
      <div className="space-y-4 rounded-[24px] border border-ash bg-[#f8fafc] p-4">
        <div className="relative overflow-hidden rounded-2xl bg-white">
          {frontPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={frontPreviewUrl}
              alt="Passport front"
              className="w-full object-contain"
            />
          ) : (
            <div className="flex min-h-[220px] items-center justify-center px-6 text-center text-sm text-slate-helper">
              Passport preview unavailable — use the edit button to re-upload
            </div>
          )}
          {!frontLocked && (
            <button
              type="button"
              aria-label="Re-upload front"
              onClick={onEditFront}
              className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#3b82f6] text-white shadow-md"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
        {comments?.['passport-front'] && !frontLocked && (
          <p className="text-xs leading-5 text-portrait-ink">
            {comments['passport-front']}
          </p>
        )}
        {(backPreviewUrl || (editableKeys?.has('passport-back') ?? false)) && (
          <div className="relative overflow-hidden rounded-2xl bg-white">
            {backPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={backPreviewUrl}
                alt="Passport back"
                className="w-full object-contain"
              />
            ) : (
              <div className="flex min-h-[160px] items-center justify-center px-6 text-center text-sm text-slate-helper">
                Passport back is not on file yet
              </div>
            )}
            {!backLocked && onEditBack && (
              <button
                type="button"
                aria-label="Re-upload back"
                onClick={onEditBack}
                className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#3b82f6] text-white shadow-md"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        {comments?.['passport-back'] && !backLocked && (
          <p className="text-xs leading-5 text-portrait-ink">
            {comments['passport-back']}
          </p>
        )}
      </div>

      <div className="space-y-5">
        {(warnings?.length ?? 0) > 0 && (
          <p className="rounded-2xl border border-peach-wash bg-peach-wash/60 px-4 py-2 text-xs text-portrait-ink">
            {warnings?.join(' · ')}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          {gate('givenNames', (
            <UnderlineField label="First name" required value={form.givenNames} onChange={set('givenNames')} />
          ))}
          {gate('surname', (
            <UnderlineField label="Last name" required value={form.surname} onChange={set('surname')} />
          ))}
          {gate('fathersName', (
            <UnderlineField label="Father's name" value={form.fathersName || ''} onChange={set('fathersName')} />
          ))}
          {gate('mothersName', (
            <UnderlineField label="Mother's name" value={form.mothersName || ''} onChange={set('mothersName')} />
          ))}
          {gate('sex', (
            <UnderlineSelect
              label="Gender"
              required
              value={form.sex}
              onChange={(value) =>
                onChange({ ...form, sex: value as IndianPassportFields['sex'] })
              }
            >
              <option value="">Select</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="X">Other</option>
            </UnderlineSelect>
          ))}
          {gate('passportNumber', (
            <UnderlineField label="Passport number" required value={form.passportNumber} onChange={set('passportNumber')} />
          ))}
          {gate('dateOfBirth', (
            <UnderlineField
              label="Date of birth"
              required
              type="date"
              max={pastMax}
              value={toDateInputValue(form.dateOfBirth)}
              error={pastDateError(toDateInputValue(form.dateOfBirth) || undefined)}
              onChange={(value) => onChange({ ...form, dateOfBirth: value })}
            />
          ))}
          {gate('dateOfIssue', (
            <UnderlineField
              label="Passport issued on"
              type="date"
              max={pastMax}
              value={toDateInputValue(form.dateOfIssue)}
              error={pastDateError(toDateInputValue(form.dateOfIssue) || undefined)}
              onChange={(value) => onChange({ ...form, dateOfIssue: value })}
            />
          ))}
          {gate('dateOfExpiry', (
            <UnderlineField
              label="Passport valid till"
              required
              type="date"
              min={futureMin}
              value={toDateInputValue(form.dateOfExpiry)}
              error={futureDateError(toDateInputValue(form.dateOfExpiry) || undefined)}
              onChange={(value) => onChange({ ...form, dateOfExpiry: value })}
            />
          ))}
          {gate('placeOfBirth', (
            <UnderlineField label="Place of birth" value={form.placeOfBirth || ''} onChange={set('placeOfBirth')} />
          ))}
          {gate('placeOfIssue', (
            <UnderlineField label="Place of issue" value={form.placeOfIssue || ''} onChange={set('placeOfIssue')} />
          ))}
          {gate('nationality', (
            <UnderlineField label="Nationality" value={form.nationality || ''} onChange={set('nationality')} />
          ))}
          {gate('spouseName', (
            <UnderlineField label="Spouse's name" value={form.spouseName || ''} onChange={set('spouseName')} />
          ))}
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
              {gate('address', (
                <UnderlineField label="Address" value={form.address || ''} onChange={set('address')} />
              ))}
            </div>
            {gate('fileNumber', (
              <UnderlineField label="File number" value={form.fileNumber || ''} onChange={set('fileNumber')} />
            ))}
            {gate('oldPassportNumber', (
              <UnderlineField label="Old passport number" value={form.oldPassportNumber || ''} onChange={set('oldPassportNumber')} />
            ))}
            {gate('oldPassportDateOfIssue', (
              <UnderlineField
                label="Old passport issued on"
                type="date"
                max={pastMax}
                value={toDateInputValue(form.oldPassportDateOfIssue)}
                error={pastDateError(toDateInputValue(form.oldPassportDateOfIssue) || undefined)}
                onChange={(value) => onChange({ ...form, oldPassportDateOfIssue: value })}
              />
            ))}
            {gate('oldPassportPlaceOfIssue', (
              <UnderlineField
                label="Old passport place of issue"
                value={form.oldPassportPlaceOfIssue || ''}
                onChange={set('oldPassportPlaceOfIssue')}
              />
            ))}
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
            {gate('email', (
              <UnderlineField
                label="Email address"
                required
                type="email"
                value={form.email || ''}
                onChange={(value) => onChange({ ...form, email: value })}
              />
            ))}
            {gate('phone', (
              <UnderlineField
                label="Phone number"
                required
                value={form.phone || ''}
                onChange={(value) =>
                  onChange({
                    ...form,
                    phone: value.replace(/\D/g, '').slice(0, 10),
                  })
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
