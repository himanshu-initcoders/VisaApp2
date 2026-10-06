'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Trash2, Upload } from 'lucide-react';
import type {
  ApplyDocumentSlot,
  TravellerDocumentUpload,
} from '@/lib/apply/applicationForm';
import {
  isAllowedPassportFile,
  isWithinUploadLimit,
} from '@/lib/apply/applicationForm';
import {
  IdbUnavailableError,
  deleteFile,
  idbErrorMessage,
  isIdbAvailable,
  putFile,
} from '@/lib/apply/idbDraftStorage';

interface DocumentsTabProps {
  listingId: string;
  passengerId: string;
  slots: ApplyDocumentSlot[];
  uploads: TravellerDocumentUpload[];
  passportPreviewUrl?: string;
  onChange: (next: TravellerDocumentUpload[]) => void;
  editableKeys?: ReadonlySet<string>;
  comments?: Record<string, string>;
  /** Correction reuploads stay in memory until send. Apply flow uses IndexedDB. */
  storage?: 'idb' | 'memory';
}

function revokeIfObjectUrl(url?: string) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
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
}: {
  slot: ApplyDocumentSlot;
  upload?: TravellerDocumentUpload;
  busy: boolean;
  locked: boolean;
  note?: string;
  allowRemove?: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const isImage = Boolean(upload?.mimeType.startsWith('image/'));

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
        </div>
        {upload && (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-mint-wash text-[#00a32a]">
            <Check className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      {upload && isImage && upload.previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={upload.previewUrl}
          alt={slot.title}
          className="mt-3 max-h-40 w-full rounded-2xl object-contain bg-[#f8fafc]"
        />
      )}
      {upload && !isImage && (
        <p className="mt-3 truncate text-xs text-portrait-ink">{upload.name}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={slot.accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
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
        }}
      />
      <div className="mt-4 flex flex-wrap items-center gap-2" inert={locked ? true : undefined}>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-full bg-[#eef4ff] px-4 py-2 text-sm font-medium text-[#3b82f6] transition-colors hover:bg-[#dce8ff] disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {upload ? 'Replace file' : 'Upload from device'}
        </button>
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
  passportPreviewUrl,
  onChange,
  editableKeys,
  comments,
  storage = 'idb',
}: DocumentsTabProps) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const byKey = new Map(uploads.map((item) => [item.key, item]));

  useEffect(() => {
    if (storage === 'memory') return;
    if (!isIdbAvailable()) {
      setStorageError(new IdbUnavailableError().message);
    }
  }, [storage]);

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
      await putFile(listingId, passengerId, slot.key, {
        blob: file,
        mimeType: file.type || 'application/octet-stream',
        filename: file.name,
      });
      const previewUrl = URL.createObjectURL(file);
      revokeIfObjectUrl(previous?.previewUrl);
      const next: TravellerDocumentUpload = {
        key: slot.key,
        name: file.name,
        previewUrl,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        storedInIdb: true,
      };
      onChange([...uploads.filter((item) => item.key !== slot.key), next]);
    } catch (error) {
      setStorageError(idbErrorMessage(error));
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
        await deleteFile(listingId, passengerId, slot.key);
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

      {passportPreviewUrl && (
        <div className="rounded-[24px] border border-ash bg-[#f8fafc] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-portrait-ink">
              Passport bio page
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-mint-wash px-2.5 py-1 text-[11px] font-medium text-[#00a32a]">
              <Check className="h-3 w-3" />
              Uploaded
            </span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={passportPreviewUrl}
            alt="Passport"
            className="mt-3 max-h-44 w-full rounded-2xl object-contain bg-white"
          />
        </div>
      )}

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
