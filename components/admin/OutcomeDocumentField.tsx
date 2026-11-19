'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Eye, X } from 'lucide-react';
import { getDocumentPreviewUrl } from '@/app/(admin)/actions';
import { useTravellerSelectionOptional } from '@/components/admin/TravellerSelectionContext';
import { triggerUrlDownload } from '@/lib/apply/passportPhotoWhiteBackground';
import {
  PASSPORT_OUTCOME_SLOT,
  VISA_OUTCOME_SLOT,
  isImageMime,
  isPdfMime,
  passportOutcomeLabel,
  visaOutcomeLabel,
} from '@/lib/visa/outcomeDocumentShared';
import { cn } from '@/lib/utils';
import type { DocumentWithVerification } from '@/types/admin';

function isPdfDoc(doc: DocumentWithVerification) {
  return isPdfMime(doc.mimeType) || /\.pdf$/i.test(doc.filename || '');
}

function isImageDoc(doc: DocumentWithVerification) {
  return (
    !isPdfDoc(doc) &&
    (isImageMime(doc.mimeType) || /\.(jpe?g|png|webp)$/i.test(doc.filename || ''))
  );
}

function DownloadIconButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-full',
        'bg-sky-wash text-portrait-ink transition-colors hover:bg-sky-wash/70',
        'disabled:cursor-not-allowed disabled:opacity-50'
      )}
    >
      <Download className="h-4 w-4" />
    </button>
  );
}

function OutcomePreviewDialog({
  doc,
  label,
  url,
  loading,
  error,
  onClose,
  onDownload,
}: {
  doc: DocumentWithVerification;
  label: string;
  url: string | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onDownload: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const pdf = Boolean(url && isPdfDoc(doc));
  const image = Boolean(url && isImageDoc(doc));

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] bg-white shadow-elevated"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ash px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-switzer text-sm font-semibold text-portrait-ink">
              {label}
            </p>
            <p className="truncate font-switzer text-xs text-slate-helper">
              {doc.filename}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DownloadIconButton
              onClick={onDownload}
              disabled={!url || loading}
              label={`Download ${label}`}
            />
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-helper transition-colors hover:bg-sky-wash hover:text-portrait-ink"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="flex min-h-[50vh] flex-1 items-center justify-center bg-[#f8fafc] p-4">
          {loading && (
            <p className="font-switzer text-sm text-slate-helper">
              Loading preview…
            </p>
          )}
          {!loading && error && (
            <p className="px-4 text-center font-switzer text-sm text-[#ff4940]">
              {error}
            </p>
          )}
          {!loading && url && image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={doc.filename}
              className="max-h-[75vh] max-w-full object-contain"
            />
          )}
          {!loading && url && pdf && (
            <iframe
              title={doc.filename}
              src={url}
              className="h-[75vh] w-full rounded-2xl bg-white"
            />
          )}
          {!loading && url && !image && !pdf && (
            <div className="text-center">
              <p className="font-switzer text-sm text-portrait-ink">
                Preview isn&apos;t available for this file type.
              </p>
              <button
                type="button"
                onClick={onDownload}
                className="mt-3 inline-flex items-center gap-2 font-switzer text-sm font-medium text-nautical-teal hover:text-portrait-ink"
              >
                <Download className="h-4 w-4 shrink-0" />
                Download file
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function OutcomeDocumentRow({
  doc,
  label,
}: {
  doc: DocumentWithVerification;
  label: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const ensureUrl = async () => {
    if (url) return url;
    setLoading(true);
    setError('');
    try {
      const result = await getDocumentPreviewUrl(doc.id);
      if (!result.success || !result.data?.url) {
        const message = result.message || 'Could not load document';
        setError(message);
        throw new Error(message);
      }
      setUrl(result.data.url);
      return result.data.url;
    } finally {
      setLoading(false);
    }
  };

  const openPreview = async () => {
    setOpen(true);
    try {
      await ensureUrl();
    } catch {
      // error state shown in dialog
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      const resolved = await ensureUrl();
      triggerUrlDownload(resolved, doc.filename || 'document');
    } catch {
      // keep error visible when dialog is open
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div className="col-span-2">
        <dt className="mb-1 font-switzer text-xs text-slate-helper">{label}</dt>
        <dd className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ash bg-white px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate font-switzer text-sm font-medium text-portrait-ink">
              {doc.filename || label}
            </p>
            <p className="font-switzer text-xs text-slate-helper">
              Uploaded{' '}
              {new Date(doc.uploadedAt).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
              })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void openPreview()}
              title="Preview"
              aria-label={`Preview ${label}`}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-full',
                'bg-sky-wash text-portrait-ink transition-colors hover:bg-sky-wash/70'
              )}
            >
              <Eye className="h-4 w-4" />
            </button>
            <DownloadIconButton
              onClick={() => void download()}
              disabled={downloading}
              label={`Download ${label}`}
            />
          </div>
        </dd>
      </div>
      {open ? (
        <OutcomePreviewDialog
          doc={doc}
          label={label}
          url={url}
          loading={loading}
          error={error}
          onClose={() => setOpen(false)}
          onDownload={() => void download()}
        />
      ) : null}
    </>
  );
}

export function OutcomeDocumentField({
  documents,
  applicationType,
  applicationStatus,
}: {
  documents: DocumentWithVerification[];
  applicationType: 'visa' | 'passport';
  applicationStatus: string;
}) {
  const selection = useTravellerSelectionOptional();
  const slot =
    applicationType === 'visa' ? VISA_OUTCOME_SLOT : PASSPORT_OUTCOME_SLOT;
  const label =
    applicationType === 'visa' ? visaOutcomeLabel() : passportOutcomeLabel();

  const statusForGate =
    selection?.activeTraveller?.status || applicationStatus;
  if (statusForGate !== 'approved') return null;

  const scoped = selection
    ? selection.filterDocuments(documents)
    : documents;
  const outcomes = scoped.filter((doc) => doc.documentType === slot);
  if (outcomes.length === 0) return null;

  return (
    <>
      {outcomes.map((doc) => (
        <OutcomeDocumentRow key={doc.id} doc={doc} label={label} />
      ))}
    </>
  );
}
