'use client';

import { useRef, useState } from 'react';
import { Check, Upload } from 'lucide-react';
import type {
  ApplyDocumentSlot,
  TravellerDocumentUpload,
} from '@/lib/apply/applicationForm';
import {
  isAllowedPassportFile,
  isWithinUploadLimit,
  readFileAsDataUrl,
} from '@/lib/apply/applicationForm';

interface DocumentsTabProps {
  slots: ApplyDocumentSlot[];
  uploads: TravellerDocumentUpload[];
  passportPreviewUrl?: string;
  onChange: (next: TravellerDocumentUpload[]) => void;
}

function SlotCard({
  slot,
  upload,
  onFile,
}: {
  slot: ApplyDocumentSlot;
  upload?: TravellerDocumentUpload;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const isImage = Boolean(upload?.mimeType.startsWith('image/'));

  return (
    <div className="rounded-[24px] border border-ash bg-white p-4 shadow-sm">
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

      {upload && isImage && (
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
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#eef4ff] px-4 py-2 text-sm font-medium text-[#3b82f6] transition-colors hover:bg-[#dce8ff]"
      >
        <Upload className="h-4 w-4" />
        {upload ? 'Replace file' : 'Upload from device'}
      </button>
      {error && <p className="mt-2 text-xs text-[#ff4940]">{error}</p>}
    </div>
  );
}

export function DocumentsTab({
  slots,
  uploads,
  passportPreviewUrl,
  onChange,
}: DocumentsTabProps) {
  const byKey = new Map(uploads.map((item) => [item.key, item]));

  const handleFile = async (slot: ApplyDocumentSlot, file: File) => {
    const previewUrl = file.type.startsWith('image/')
      ? URL.createObjectURL(file)
      : await readFileAsDataUrl(file);
    const next: TravellerDocumentUpload = {
      key: slot.key,
      name: file.name,
      previewUrl,
      mimeType: file.type || 'application/octet-stream',
    };
    onChange([
      ...uploads.filter((item) => item.key !== slot.key),
      next,
    ]);
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
        {slots.map((slot) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            upload={byKey.get(slot.key)}
            onFile={(file) => {
              void handleFile(slot, file);
            }}
          />
        ))}
      </div>
    </div>
  );
}
