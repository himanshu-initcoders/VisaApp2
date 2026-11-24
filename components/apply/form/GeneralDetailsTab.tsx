'use client';

import { Upload } from 'lucide-react';
import type { ReactNode } from 'react';
import { DocumentSlotThumb } from '@/components/apply/DocumentSlotThumb';
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

function PassportSideMedia({
  previewUrl,
  mimeType,
  filename,
  alt,
  emptyLabel,
  minHeightClass,
  listingId,
  travellerId,
  slotKey,
  storageKey,
  storageUrl,
  sessionUserId,
  ownerUserId,
}: {
  previewUrl?: string;
  mimeType?: string;
  filename?: string;
  alt: string;
  emptyLabel: string;
  minHeightClass: string;
  listingId?: string;
  travellerId?: string;
  slotKey?: string;
  storageKey?: string;
  storageUrl?: string;
  sessionUserId?: string | null;
  ownerUserId?: string | null;
}) {
  const hasSource = Boolean(
    previewUrl || storageUrl || storageKey || (listingId && travellerId && slotKey)
  );
  if (!hasSource) {
    return (
      <div
        className={`flex ${minHeightClass} items-center justify-center px-6 text-center text-sm text-slate-helper`}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <DocumentSlotThumb
      title={alt}
      previewUrl={previewUrl}
      mimeType={mimeType}
      filename={filename}
      listingId={listingId}
      travellerId={travellerId}
      slotKey={slotKey}
      storageKey={storageKey}
      storageUrl={storageUrl || previewUrl}
      sessionUserId={sessionUserId}
      ownerUserId={ownerUserId}
      className={`flex ${minHeightClass} w-full items-start justify-center overflow-hidden bg-white`}
      imgClassName="h-auto w-full object-contain object-top"
    />
  );
}

interface GeneralDetailsTabProps {
  form: IndianPassportFields;
  onChange: (next: IndianPassportFields) => void;
  frontPreviewUrl: string;
  backPreviewUrl?: string;
  frontMimeType?: string;
  backMimeType?: string;
  frontFilename?: string;
  backFilename?: string;
  frontStorageKey?: string;
  backStorageKey?: string;
  frontStorageUrl?: string;
  backStorageUrl?: string;
  listingId?: string;
  travellerId?: string;
  sessionUserId?: string | null;
  ownerUserId?: string | null;
  warnings?: string[];
  onEditFront: () => void;
  onEditBack?: () => void;
  /** Which passport side is currently being reuploaded / OCR'd. */
  replaceBusy?: 'front' | 'back' | null;
  /** When set, only these `passport.*` and passport image keys stay editable. */
  editableKeys?: ReadonlySet<string>;
  comments?: Record<string, string>;
  /**
   * Form Builder OCR step questions. When set, only these system fields render
   * (with admin labels / required flags). When omitted, show the full default set.
   */
  configuredFields?: Array<{
    systemKey?: string | null;
    label: string;
    required: boolean;
  }> | null;
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
  frontMimeType,
  backMimeType,
  frontFilename,
  backFilename,
  frontStorageKey,
  backStorageKey,
  frontStorageUrl,
  backStorageUrl,
  listingId,
  travellerId,
  sessionUserId = null,
  ownerUserId = null,
  warnings,
  onEditFront,
  onEditBack,
  replaceBusy = null,
  editableKeys,
  comments,
  configuredFields = null,
}: GeneralDetailsTabProps) {
  const pastMax = latestPastDateIso();
  const futureMin = earliestFutureDateIso();
  const frontLocked = Boolean(editableKeys && !editableKeys.has('passport-front'));
  const backLocked = Boolean(editableKeys && !editableKeys.has('passport-back'));
  const frontBusy = replaceBusy === 'front';
  const backBusy = replaceBusy === 'back';

  const fieldMeta = (systemKey: string) =>
    configuredFields?.find((f) => f.systemKey === systemKey);
  const showField = (systemKey: string) =>
    !configuredFields || Boolean(fieldMeta(systemKey));
  const fieldLabel = (systemKey: string, fallback: string) =>
    fieldMeta(systemKey)?.label ?? fallback;
  const fieldRequired = (systemKey: string, fallback: boolean) =>
    fieldMeta(systemKey)?.required ?? fallback;

  /** Few fields → stack passport + form so the page doesn't leave a huge empty column. */
  const visibleFieldCount = configuredFields
    ? configuredFields.filter((f) => f.systemKey).length
    : 12;
  const compactLayout = visibleFieldCount <= 4;

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
    <div
      className={
        compactLayout
          ? 'mx-auto grid max-w-3xl gap-6'
          : 'grid items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10'
      }
    >
      <div
        className={
          compactLayout
            ? 'grid gap-3 sm:grid-cols-2'
            : 'space-y-3 rounded-[24px] border border-ash bg-[#f8fafc] p-3'
        }
      >
        <div
          className={`relative overflow-hidden rounded-2xl bg-white ${
            compactLayout ? 'border border-ash' : ''
          }`}
        >
          <PassportSideMedia
            previewUrl={frontPreviewUrl}
            mimeType={frontMimeType}
            filename={frontFilename}
            alt="Passport front"
            emptyLabel="Passport preview unavailable — use Reupload to try again"
            minHeightClass={compactLayout ? 'min-h-[120px]' : 'min-h-[160px]'}
            listingId={listingId}
            travellerId={travellerId}
            slotKey="passport-front"
            storageKey={frontStorageKey}
            storageUrl={frontStorageUrl}
            sessionUserId={sessionUserId}
            ownerUserId={ownerUserId}
          />
          {!frontLocked && (
            <button
              type="button"
              aria-label="Reupload passport front"
              disabled={Boolean(replaceBusy)}
              onClick={onEditFront}
              className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-portrait-ink px-3 py-1.5 text-xs font-medium text-white shadow-md disabled:opacity-60"
            >
              <Upload className="h-3.5 w-3.5 shrink-0" />
              {frontBusy ? 'Reading…' : 'Reupload'}
            </button>
          )}
        </div>
        {comments?.['passport-front'] && !frontLocked && (
          <p className="text-xs leading-5 text-portrait-ink sm:col-span-2">
            {comments['passport-front']}
          </p>
        )}
        {(backPreviewUrl ||
          backStorageKey ||
          backStorageUrl ||
          (editableKeys?.has('passport-back') ?? false)) && (
          <div
            className={`relative overflow-hidden rounded-2xl bg-white ${
              compactLayout ? 'border border-ash' : ''
            }`}
          >
            <PassportSideMedia
              previewUrl={backPreviewUrl}
              mimeType={backMimeType}
              filename={backFilename}
              alt="Passport back"
              emptyLabel="Passport back is not on file yet"
              minHeightClass={compactLayout ? 'min-h-[100px]' : 'min-h-[120px]'}
              listingId={listingId}
              travellerId={travellerId}
              slotKey="passport-back"
              storageKey={backStorageKey}
              storageUrl={backStorageUrl}
              sessionUserId={sessionUserId}
              ownerUserId={ownerUserId}
            />
            {!backLocked && onEditBack && (
              <button
                type="button"
                aria-label="Reupload passport back"
                disabled={Boolean(replaceBusy)}
                onClick={onEditBack}
                className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-portrait-ink px-3 py-1.5 text-xs font-medium text-white shadow-md disabled:opacity-60"
              >
                <Upload className="h-3.5 w-3.5 shrink-0" />
                {backBusy ? 'Reading…' : 'Reupload'}
              </button>
            )}
          </div>
        )}
        {comments?.['passport-back'] && !backLocked && (
          <p className="text-xs leading-5 text-portrait-ink sm:col-span-2">
            {comments['passport-back']}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {(warnings?.length ?? 0) > 0 && (
          <p className="rounded-2xl border border-peach-wash bg-peach-wash/60 px-4 py-2 text-xs text-portrait-ink">
            {warnings?.join(' · ')}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          {showField('givenNames') &&
            gate('givenNames', (
              <UnderlineField
                label={fieldLabel('givenNames', 'First name')}
                required={fieldRequired('givenNames', true)}
                value={form.givenNames}
                onChange={set('givenNames')}
              />
            ))}
          {showField('surname') &&
            gate('surname', (
              <UnderlineField
                label={fieldLabel('surname', 'Last name')}
                required={fieldRequired('surname', true)}
                value={form.surname}
                onChange={set('surname')}
              />
            ))}
          {showField('fathersName') &&
            gate('fathersName', (
              <UnderlineField
                label={fieldLabel('fathersName', "Father's name")}
                required={fieldRequired('fathersName', false)}
                value={form.fathersName || ''}
                onChange={set('fathersName')}
              />
            ))}
          {showField('mothersName') &&
            gate('mothersName', (
              <UnderlineField
                label={fieldLabel('mothersName', "Mother's name")}
                required={fieldRequired('mothersName', false)}
                value={form.mothersName || ''}
                onChange={set('mothersName')}
              />
            ))}
          {showField('sex') &&
            gate('sex', (
              <UnderlineSelect
                label={fieldLabel('sex', 'Gender')}
                required={fieldRequired('sex', true)}
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
          {showField('passportNumber') &&
            gate('passportNumber', (
              <UnderlineField
                label={fieldLabel('passportNumber', 'Passport number')}
                required={fieldRequired('passportNumber', true)}
                value={form.passportNumber}
                onChange={set('passportNumber')}
              />
            ))}
          {showField('dateOfBirth') &&
            gate('dateOfBirth', (
              <UnderlineField
                label={fieldLabel('dateOfBirth', 'Date of birth')}
                required={fieldRequired('dateOfBirth', true)}
                type="date"
                max={pastMax}
                value={toDateInputValue(form.dateOfBirth)}
                error={pastDateError(toDateInputValue(form.dateOfBirth) || undefined)}
                onChange={(value) => onChange({ ...form, dateOfBirth: value })}
              />
            ))}
          {showField('dateOfIssue') &&
            gate('dateOfIssue', (
              <UnderlineField
                label={fieldLabel('dateOfIssue', 'Passport issued on')}
                required={fieldRequired('dateOfIssue', false)}
                type="date"
                max={pastMax}
                value={toDateInputValue(form.dateOfIssue)}
                error={pastDateError(toDateInputValue(form.dateOfIssue) || undefined)}
                onChange={(value) => onChange({ ...form, dateOfIssue: value })}
              />
            ))}
          {showField('dateOfExpiry') &&
            gate('dateOfExpiry', (
              <UnderlineField
                label={fieldLabel('dateOfExpiry', 'Passport valid till')}
                required={fieldRequired('dateOfExpiry', true)}
                type="date"
                min={futureMin}
                value={toDateInputValue(form.dateOfExpiry)}
                error={futureDateError(toDateInputValue(form.dateOfExpiry) || undefined)}
                onChange={(value) => onChange({ ...form, dateOfExpiry: value })}
              />
            ))}
          {showField('placeOfBirth') &&
            gate('placeOfBirth', (
              <UnderlineField
                label={fieldLabel('placeOfBirth', 'Place of birth')}
                required={fieldRequired('placeOfBirth', false)}
                value={form.placeOfBirth || ''}
                onChange={set('placeOfBirth')}
              />
            ))}
          {showField('placeOfIssue') &&
            gate('placeOfIssue', (
              <UnderlineField
                label={fieldLabel('placeOfIssue', 'Place of issue')}
                required={fieldRequired('placeOfIssue', false)}
                value={form.placeOfIssue || ''}
                onChange={set('placeOfIssue')}
              />
            ))}
          {showField('nationality') &&
            gate('nationality', (
              <UnderlineField
                label={fieldLabel('nationality', 'Nationality')}
                required={fieldRequired('nationality', false)}
                value={form.nationality || ''}
                onChange={set('nationality')}
              />
            ))}
          {showField('spouseName') &&
            gate('spouseName', (
              <UnderlineField
                label={fieldLabel('spouseName', "Spouse's name")}
                required={fieldRequired('spouseName', false)}
                value={form.spouseName || ''}
                onChange={set('spouseName')}
              />
            ))}
          {showField('countryOfIssue') &&
            gate('countryOfIssue', (
              <UnderlineField
                label={fieldLabel('countryOfIssue', 'Country of issue')}
                required={fieldRequired('countryOfIssue', false)}
                value={form.countryOfIssue || ''}
                onChange={set('countryOfIssue')}
              />
            ))}
        </div>

        {(showField('address') ||
          showField('fileNumber') ||
          showField('oldPassportNumber') ||
          showField('oldPassportDateOfIssue') ||
          showField('oldPassportPlaceOfIssue')) && (
          <div className="pt-4">
            <h2 className="font-basier text-xl text-portrait-ink">
              Address &amp; Previous Passport
            </h2>
            <p className="mt-1 text-sm text-slate-helper">
              Read from the back page of your passport.
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {showField('address') && (
                <div className="sm:col-span-2">
                  {gate('address', (
                    <UnderlineField
                      label={fieldLabel('address', 'Address')}
                      required={fieldRequired('address', false)}
                      value={form.address || ''}
                      onChange={set('address')}
                    />
                  ))}
                </div>
              )}
              {showField('fileNumber') &&
                gate('fileNumber', (
                  <UnderlineField
                    label={fieldLabel('fileNumber', 'File number')}
                    required={fieldRequired('fileNumber', false)}
                    value={form.fileNumber || ''}
                    onChange={set('fileNumber')}
                  />
                ))}
              {showField('oldPassportNumber') &&
                gate('oldPassportNumber', (
                  <UnderlineField
                    label={fieldLabel('oldPassportNumber', 'Old passport number')}
                    required={fieldRequired('oldPassportNumber', false)}
                    value={form.oldPassportNumber || ''}
                    onChange={set('oldPassportNumber')}
                  />
                ))}
              {showField('oldPassportDateOfIssue') &&
                gate('oldPassportDateOfIssue', (
                  <UnderlineField
                    label={fieldLabel(
                      'oldPassportDateOfIssue',
                      'Old passport issued on'
                    )}
                    required={fieldRequired('oldPassportDateOfIssue', false)}
                    type="date"
                    max={pastMax}
                    value={toDateInputValue(form.oldPassportDateOfIssue)}
                    error={pastDateError(
                      toDateInputValue(form.oldPassportDateOfIssue) || undefined
                    )}
                    onChange={(value) =>
                      onChange({ ...form, oldPassportDateOfIssue: value })
                    }
                  />
                ))}
              {showField('oldPassportPlaceOfIssue') &&
                gate('oldPassportPlaceOfIssue', (
                  <UnderlineField
                    label={fieldLabel(
                      'oldPassportPlaceOfIssue',
                      'Old passport place of issue'
                    )}
                    required={fieldRequired('oldPassportPlaceOfIssue', false)}
                    value={form.oldPassportPlaceOfIssue || ''}
                    onChange={set('oldPassportPlaceOfIssue')}
                  />
                ))}
            </div>
          </div>
        )}

        {(showField('email') || showField('phone')) && (
          <div className="pt-4">
            <h2 className="font-basier text-xl text-portrait-ink">
              Contact Details
            </h2>
            <p className="mt-1 text-sm text-slate-helper">
              Required for sharing essential visa updates. In real time.
            </p>
            <div className="mt-5 space-y-5">
              {showField('email') &&
                gate('email', (
                  <UnderlineField
                    label={fieldLabel('email', 'Email address')}
                    required={fieldRequired('email', true)}
                    type="email"
                    value={form.email || ''}
                    onChange={(value) => onChange({ ...form, email: value })}
                  />
                ))}
              {showField('phone') &&
                gate('phone', (
                  <UnderlineField
                    label={fieldLabel('phone', 'Phone number')}
                    required={fieldRequired('phone', true)}
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
        )}
      </div>
    </div>
  );
}
