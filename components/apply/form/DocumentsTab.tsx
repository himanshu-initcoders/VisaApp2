'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Download, Eye, Loader2, Trash2, Upload } from 'lucide-react';
import { DocumentSlotThumb } from '@/components/apply/DocumentSlotThumb';
import {
  DocumentPreviewModal,
  type DocumentPreviewItem,
} from '@/components/apply/review/DocumentPreviewModal';
import { PassportPhotoCaptureDialog } from '@/components/apply/form/PassportPhotoCaptureDialog';
import type {
  ApplyDocumentSlot,
  TravellerDocumentUpload,
} from '@/lib/apply/applicationForm';
import {
  isAllowedPassportFile,
  isWithinUploadLimit,
} from '@/lib/apply/applicationForm';
import type { DraftScopeInput } from '@/lib/apply/draftScope';
import {
  IdbUnavailableError,
  PASSPORT_BACK_SLOT,
  PASSPORT_FRONT_SLOT,
  deleteFile,
  idbErrorMessage,
  isIdbAvailable,
  putFile,
} from '@/lib/apply/idbDraftStorage';
import { deleteServerDraftFile } from '@/lib/apply/deleteDraftFileClient';
import { resolveDocumentPreviewUrl } from '@/lib/apply/resolveDocumentPreview';
import type { DraftFileRef } from '@/lib/apply/types';
import { trackEvent } from '@/lib/analytics/gtm';

interface DocumentsTabProps {
  listingId: string;
  passengerId: string;
  slots: ApplyDocumentSlot[];
  uploads: TravellerDocumentUpload[];
  /** Fallback server keys when uploads were not yet stamped with storageKey. */
  draftFileRefs?: DraftFileRef[];
  passportPreviewUrl?: string;
  /** When OCR already captured the back page, show it as uploaded. */
  passportBackPreviewUrl?: string;
  passportFrontMimeType?: string;
  passportBackMimeType?: string;
  passportFrontFilename?: string;
  passportBackFilename?: string;
  /** Reupload passport side (OCR runs in the review stage). */
  onReplacePassportFront?: (file: File) => void;
  onReplacePassportBack?: (file: File) => void;
  passportReplaceBusy?: 'front' | 'back' | null;
  onChange: (next: TravellerDocumentUpload[]) => void;
  editableKeys?: ReadonlySet<string>;
  comments?: Record<string, string>;
  /** Correction reuploads stay in memory until send. Apply flow uses IndexedDB. */
  storage?: 'idb' | 'memory';
  sessionUserId?: string | null;
  ownerUserId?: string | null;
}

function revokeIfObjectUrl(url?: string) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

function PassportPreviewCard({
  title,
  previewUrl,
  mimeType,
  filename,
  busy,
  onReplace,
  listingId,
  travellerId,
  slotKey,
  storageKey,
  storageUrl,
  sessionUserId,
  ownerUserId,
  onView,
  viewBusy,
}: {
  title: string;
  previewUrl?: string;
  mimeType?: string;
  filename?: string;
  busy?: boolean;
  onReplace?: (file: File) => void;
  listingId: string;
  travellerId: string;
  slotKey: string;
  storageKey?: string;
  storageUrl?: string;
  sessionUserId?: string | null;
  ownerUserId?: string | null;
  onView?: () => void;
  viewBusy?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const canView = Boolean(
    previewUrl || storageUrl || storageKey || (listingId && travellerId && slotKey)
  );

  const acceptFile = (file: File) => {
    if (!isAllowedPassportFile(file)) {
      setError('Please upload a JPG, PNG, WEBP, or PDF file.');
      return;
    }
    if (!isWithinUploadLimit(file)) {
      setError('File is too large. Max 5MB for images, 10MB for PDFs.');
      return;
    }
    setError(null);
    onReplace?.(file);
  };

  return (
    <div className="rounded-[24px] border border-ash bg-[#f8fafc] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-portrait-ink">{title}</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-mint-wash px-2.5 py-1 text-[11px] font-medium text-[#00a32a]">
          <Check className="h-3 w-3" />
          Uploaded
        </span>
      </div>
      <DocumentSlotThumb
        title={title}
        previewUrl={previewUrl}
        mimeType={mimeType}
        filename={filename}
        listingId={listingId}
        travellerId={travellerId}
        slotKey={slotKey}
        storageKey={storageKey}
        storageUrl={storageUrl}
        sessionUserId={sessionUserId}
        ownerUserId={ownerUserId}
        className="mt-3 flex max-h-44 min-h-[11rem] items-center justify-center overflow-hidden rounded-2xl bg-white"
        imgClassName="mt-3 max-h-44 w-full rounded-2xl object-contain bg-white"
      />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {onView && (
          <button
            type="button"
            disabled={!canView || viewBusy || busy}
            onClick={onView}
            className="inline-flex items-center gap-2 rounded-full border border-ash bg-white px-4 py-2 text-sm font-medium text-portrait-ink transition-colors hover:bg-sky-wash disabled:cursor-not-allowed disabled:opacity-60"
          >
            {viewBusy ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 shrink-0" />
            )}
            View
          </button>
        )}
        {onReplace && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/jpg,application/pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                acceptFile(file);
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full bg-sky-wash px-4 py-2 text-sm font-medium text-portrait-ink transition-colors hover:bg-portrait-ink/10 disabled:opacity-60"
            >
              <Upload className="h-4 w-4 shrink-0" />
              Replace file
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-[#ff4940]">{error}</p>}
    </div>
  );
}

function SlotCard({
  slot,
  upload,
  busy,
  locked,
  note,
  allowRemove = true,
  onFile,
  onRemove,
  listingId,
  travellerId,
  draftFileRefs,
  sessionUserId,
  ownerUserId,
}: {
  slot: ApplyDocumentSlot;
  upload?: TravellerDocumentUpload;
  busy: boolean;
  locked: boolean;
  note?: string;
  allowRemove?: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
  listingId: string;
  travellerId: string;
  draftFileRefs?: DraftFileRef[];
  sessionUserId?: string | null;
  ownerUserId?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const ref = draftFileRefs?.find((item) => item.slotKey === slot.key);

  const acceptFile = (file: File) => {
    if (!isAllowedPassportFile(file)) {
      setError('Please upload a JPG, PNG, WEBP, or PDF file.');
      return;
    }
    if (!isWithinUploadLimit(file)) {
      setError('File is too large. Max 5MB for images, 10MB for PDFs.');
      return;
    }
    setError(null);
    onFile(file);
  };

  return (
    <div
      id={`correction-${slot.key}`}
      className={[
        'rounded-[24px] border bg-white p-4 shadow-sm',
        locked ? 'border-ash opacity-50' : note ? 'border-[#f3c9a0] bg-peach-wash/40' : 'border-ash',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-portrait-ink">
            {slot.title}
            {slot.required && <span className="text-[#ff4940]"> *</span>}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-helper">
            {slot.description}
          </p>
          {slot.sampleUrl && (
            <a
              href={slot.sampleUrl}
              target="_blank"
              rel="noreferrer"
              download={slot.sampleFilename || undefined}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-portrait-ink underline-offset-2 hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              Download sample
              {slot.sampleFilename ? ` (${slot.sampleFilename})` : ''}
            </a>
          )}
        </div>
        {upload && (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-mint-wash text-[#00a32a]">
            <Check className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      {upload ? (
        <DocumentSlotThumb
          title={slot.title}
          previewUrl={upload.previewUrl}
          storageUrl={upload.storageUrl || ref?.url}
          storageKey={upload.storageKey || ref?.storageKey}
          mimeType={upload.mimeType || ref?.mimeType}
          filename={upload.name || ref?.filename}
          listingId={listingId}
          travellerId={travellerId}
          slotKey={slot.key}
          sessionUserId={sessionUserId}
          ownerUserId={ownerUserId}
        />
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={slot.accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          acceptFile(file);
        }}
      />
      <div className="mt-4 flex flex-wrap items-center gap-2" inert={locked ? true : undefined}>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full bg-sky-wash px-4 py-2 text-sm font-medium text-portrait-ink transition-colors hover:bg-portrait-ink/10 disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {upload ? 'Replace file' : 'Upload from device'}
        </button>
        {slot.captureFace && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setCaptureOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-portrait-ink bg-white px-4 py-2 text-sm font-medium text-portrait-ink transition-colors hover:bg-sky-wash disabled:opacity-60"
          >
            <Camera className="h-4 w-4" />
            {upload ? 'Capture again' : 'Capture photo'}
          </button>
        )}
        {upload && allowRemove && (
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 rounded-full border border-ash px-3 py-2 text-sm text-slate-helper transition-colors hover:border-[#ff4940] hover:text-[#ff4940] disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-[#ff4940]">{error}</p>}
      {captureOpen && slot.captureFace && (
        <PassportPhotoCaptureDialog
          onClose={() => setCaptureOpen(false)}
          onCaptured={(file) => {
            setCaptureOpen(false);
            acceptFile(file);
          }}
        />
      )}
      {!locked && note && (
        <p className="mt-2 text-xs leading-5 text-portrait-ink">{note}</p>
      )}
    </div>
  );
}

export function DocumentsTab({
  listingId,
  passengerId,
  slots,
  uploads,
  draftFileRefs,
  passportPreviewUrl,
  passportBackPreviewUrl,
  passportFrontMimeType,
  passportBackMimeType,
  passportFrontFilename,
  passportBackFilename,
  onReplacePassportFront,
  onReplacePassportBack,
  passportReplaceBusy = null,
  onChange,
  editableKeys,
  comments,
  storage = 'idb',
  sessionUserId = null,
  ownerUserId = null,
}: DocumentsTabProps) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<DocumentPreviewItem | null>(
    null
  );
  const [viewBusyKey, setViewBusyKey] = useState<string | null>(null);
  const byKey = new Map(uploads.map((item) => [item.key, item]));
  const frontRef = draftFileRefs?.find(
    (ref) => ref.slotKey === PASSPORT_FRONT_SLOT
  );
  const backRef = draftFileRefs?.find(
    (ref) => ref.slotKey === PASSPORT_BACK_SLOT
  );
  const frontPreview =
    passportPreviewUrl?.trim() || frontRef?.url || undefined;
  const backPreview =
    passportBackPreviewUrl?.trim() || backRef?.url || undefined;
  const scope: DraftScopeInput = {
    listingId,
    sessionUserId,
    onBehalfOfUserId: ownerUserId,
  };

  useEffect(() => {
    if (storage === 'memory') return;
    if (!isIdbAvailable()) {
      setStorageError(new IdbUnavailableError().message);
    }
  }, [storage]);

  const resolveServerDraftKey = (slotKey: string, upload?: TravellerDocumentUpload) =>
    upload?.storageKey ||
    draftFileRefs?.find((ref) => ref.slotKey === slotKey)?.storageKey;

  const openPassportPreview = async (input: {
    title: string;
    slotKey: string;
    previewUrl?: string;
    storageUrl?: string;
    storageKey?: string;
    mimeType?: string;
    filename?: string;
  }) => {
    setViewBusyKey(input.slotKey);
    try {
      const resolved = await resolveDocumentPreviewUrl({
        listingId,
        travellerId: passengerId,
        slotKey: input.slotKey,
        storageKey: input.storageKey,
        ownerUserId: ownerUserId ?? undefined,
        sessionUserId,
        previewUrl: input.previewUrl,
        storageUrl: input.storageUrl,
        filename: input.filename,
      });
      if (!resolved?.url) return;
      setActivePreview({
        title: input.title,
        name: input.filename || input.title,
        previewUrl: resolved.url,
        mimeType: resolved.mimeType || input.mimeType,
      });
    } finally {
      setViewBusyKey(null);
    }
  };

  const handleFile = async (slot: ApplyDocumentSlot, file: File) => {
    if (editableKeys && !editableKeys.has(slot.key)) return;
    if (storage === 'memory') {
      const previous = byKey.get(slot.key);
      revokeIfObjectUrl(previous?.previewUrl);
      onChange([
        ...uploads.filter((item) => item.key !== slot.key),
        {
          key: slot.key,
          name: file.name,
          previewUrl: URL.createObjectURL(file),
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          file,
        },
      ]);
      return;
    }

    if (!isIdbAvailable()) {
      setStorageError(new IdbUnavailableError().message);
      return;
    }

    setBusyKey(slot.key);
    setStorageError(null);
    const previous = byKey.get(slot.key);

    try {
      await putFile(scope, passengerId, slot.key, {
        blob: file,
        mimeType: file.type || 'application/octet-stream',
        filename: file.name,
      });
      // Drop the previous server draft object so re-sync uploads the new file.
      const previousKey = resolveServerDraftKey(slot.key, previous);
      if (previousKey) {
        void deleteServerDraftFile({
          storageKey: previousKey,
          ownerUserId,
        });
      }
      const previewUrl = URL.createObjectURL(file);
      revokeIfObjectUrl(previous?.previewUrl);
      const next: TravellerDocumentUpload = {
        key: slot.key,
        name: file.name,
        previewUrl,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        storedInIdb: true,
        // Intentionally omit storageKey so draft sync re-uploads.
      };
      onChange([...uploads.filter((item) => item.key !== slot.key), next]);
      trackEvent('visa_document_upload_success', {
        slot_key: slot.key,
        storage: 'idb',
        mime_type: file.type || 'application/octet-stream',
      });
    } catch (error) {
      const message = idbErrorMessage(error);
      trackEvent('visa_document_upload_error', {
        slot_key: slot.key,
        error_message: message.slice(0, 120),
      });
      setStorageError(message);
    } finally {
      setBusyKey(null);
    }
  };

  const handleRemove = async (slot: ApplyDocumentSlot) => {
    const previous = byKey.get(slot.key);
    setBusyKey(slot.key);
    setStorageError(null);
    try {
      if (isIdbAvailable()) {
        await deleteFile(scope, passengerId, slot.key);
      }
      const previousKey = resolveServerDraftKey(slot.key, previous);
      if (previousKey) {
        void deleteServerDraftFile({
          storageKey: previousKey,
          ownerUserId,
        });
      }
      revokeIfObjectUrl(previous?.previewUrl);
      onChange(uploads.filter((item) => item.key !== slot.key));
    } catch (error) {
      setStorageError(idbErrorMessage(error));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="font-basier text-xl text-portrait-ink">Documents</h2>
        <p className="mt-1 text-sm text-slate-helper">
          Upload the remaining files this visa needs. Your passport scan is
          already attached.
        </p>
      </div>

      {storageError && (
        <p className="rounded-2xl border border-[#ffd0cc] bg-[#fff5f4] px-4 py-3 text-sm text-[#ff4940]">
          {storageError}
        </p>
      )}

      {(frontPreview || frontRef || backPreview || backRef) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {(frontPreview || frontRef) && (
            <PassportPreviewCard
              title="Passport bio page"
              previewUrl={frontPreview}
              mimeType={passportFrontMimeType || frontRef?.mimeType}
              filename={passportFrontFilename || frontRef?.filename}
              storageKey={frontRef?.storageKey}
              storageUrl={frontRef?.url || frontPreview}
              listingId={listingId}
              travellerId={passengerId}
              slotKey={PASSPORT_FRONT_SLOT}
              sessionUserId={sessionUserId}
              ownerUserId={ownerUserId}
              busy={passportReplaceBusy === 'front'}
              onReplace={onReplacePassportFront}
              viewBusy={viewBusyKey === PASSPORT_FRONT_SLOT}
              onView={() =>
                void openPassportPreview({
                  title: 'Passport bio page',
                  slotKey: PASSPORT_FRONT_SLOT,
                  previewUrl: frontPreview,
                  storageUrl: frontRef?.url || frontPreview,
                  storageKey: frontRef?.storageKey,
                  mimeType: passportFrontMimeType || frontRef?.mimeType,
                  filename: passportFrontFilename || frontRef?.filename,
                })
              }
            />
          )}
          {(backPreview || backRef) && (
            <PassportPreviewCard
              title="Passport back page"
              previewUrl={backPreview}
              mimeType={passportBackMimeType || backRef?.mimeType}
              filename={passportBackFilename || backRef?.filename}
              storageKey={backRef?.storageKey}
              storageUrl={backRef?.url || backPreview}
              listingId={listingId}
              travellerId={passengerId}
              slotKey={PASSPORT_BACK_SLOT}
              sessionUserId={sessionUserId}
              ownerUserId={ownerUserId}
              busy={passportReplaceBusy === 'back'}
              onReplace={onReplacePassportBack}
              viewBusy={viewBusyKey === PASSPORT_BACK_SLOT}
              onView={() =>
                void openPassportPreview({
                  title: 'Passport back page',
                  slotKey: PASSPORT_BACK_SLOT,
                  previewUrl: backPreview,
                  storageUrl: backRef?.url || backPreview,
                  storageKey: backRef?.storageKey,
                  mimeType: passportBackMimeType || backRef?.mimeType,
                  filename: passportBackFilename || backRef?.filename,
                })
              }
            />
          )}
        </div>
      )}

      <DocumentPreviewModal
        open={Boolean(activePreview)}
        item={activePreview}
        onClose={() => setActivePreview(null)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {[...slots]
          .sort((a, b) => {
            if (!editableKeys) return 0;
            const aOpen = editableKeys.has(a.key) ? 0 : 1;
            const bOpen = editableKeys.has(b.key) ? 0 : 1;
            return aOpen - bOpen;
          })
          .map((slot) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            upload={byKey.get(slot.key)}
            busy={busyKey === slot.key}
            locked={Boolean(editableKeys && !editableKeys.has(slot.key))}
            note={comments?.[slot.key]}
            allowRemove={storage !== 'memory'}
            listingId={listingId}
            travellerId={passengerId}
            draftFileRefs={draftFileRefs}
            sessionUserId={sessionUserId}
            ownerUserId={ownerUserId}
            onFile={(file) => {
              void handleFile(slot, file);
            }}
            onRemove={() => {
              if (storage === 'memory') return;
              void handleRemove(slot);
            }}
          />
        ))}
      </div>
    </div>
  );
}
