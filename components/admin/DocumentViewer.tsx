'use client';

import { useEffect, useState } from 'react';
import { Eye, FileText, Image as ImageIcon, X } from 'lucide-react';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import { getDocumentPreviewUrl, verifyDocument } from '@/app/(admin)/actions';
import type { ActionResponse, DocumentWithVerification } from '@/types/admin';
import { cn } from '@/lib/utils';

/**
 * Document Viewer — list or grid, with a full-screen preview dialog.
 * Staff can verify a file or request a reupload from that dialog.
 */

type PreviewUrlFn = (
  documentId: string
) => Promise<ActionResponse<{ url: string }>>;

interface DocumentViewerProps {
  documents: DocumentWithVerification[];
  onDocumentVerified?: () => void;
  /** Override preview URL resolver (e.g. user ownership check). Defaults to admin action. */
  getPreviewUrl?: PreviewUrlFn;
  /** Prefill a correction request for this document slot. */
  onRequestReupload?: (slotKey: string) => void;
  /** `grid` shows tiles and opens the file in a dialog. `list` keeps the inline preview. */
  layout?: 'list' | 'grid';
}

function statusOf(doc: DocumentWithVerification) {
  if (doc.verified === true) return 'verified' as const;
  if (doc.verified === false) return 'rejected' as const;
  return 'unverified' as const;
}

function isImageMime(mime: string | null | undefined) {
  return Boolean(mime?.startsWith('image/'));
}

function isPdfMime(mime: string | null | undefined, filename: string) {
  return (
    mime === 'application/pdf' || /\.pdf$/i.test(filename)
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function DocumentCard({
  doc,
  getPreviewUrl,
  onPreview,
}: {
  doc: DocumentWithVerification;
  getPreviewUrl: PreviewUrlFn;
  onPreview: () => void;
}) {
  const status = statusOf(doc);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      const result = await getPreviewUrl(doc.id);
      if (cancelled) return;
      if (result.success && result.data?.url) {
        setUrl(result.data.url);
      } else {
        setError(result.message || 'Could not load preview');
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [doc.id, getPreviewUrl]);

  const handleDownload = () => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.filename || 'document';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <Card
      onClick={onPreview}
      className={cn(
        'cursor-pointer transition-colors',
        status === 'verified' && 'bg-mint-wash/30',
        status === 'rejected' && 'bg-red-50/30',
        status === 'unverified' && 'bg-peach-wash/30'
      )}
    >
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="font-switzer text-sm font-semibold text-portrait-ink">
              {doc.documentType}
            </h4>
            <p className="mt-1 truncate font-switzer text-xs text-slate-helper">
              {doc.filename}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant={
                status === 'verified'
                  ? 'approved'
                  : status === 'rejected'
                    ? 'rejected'
                    : 'pending'
              }
            >
              {status === 'verified'
                ? 'Verified'
                : status === 'rejected'
                  ? 'Rejected'
                  : 'Unverified'}
            </Badge>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onPreview();
              }}
              title="Preview"
              aria-label={`Preview ${doc.filename}`}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-full',
                'bg-sky-wash text-portrait-ink transition-colors hover:bg-sky-wash/70'
              )}
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleDownload();
              }}
              disabled={!url}
              title="Download"
              aria-label={`Download ${doc.filename}`}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-full',
                'text-portrait-ink transition-colors',
                'hover:bg-sky-wash/50 disabled:cursor-not-allowed disabled:opacity-40'
              )}
            >
              <DownloadIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 font-switzer text-xs text-slate-helper">
          <span>
            {doc.fileSize
              ? `${(doc.fileSize / 1024).toFixed(1)} KB`
              : 'Unknown size'}
          </span>
          <span>•</span>
          <span>
            {new Date(doc.uploadedAt).toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>

        {status === 'rejected' && doc.verificationNotes && (
          <div className="rounded-lg bg-red-100 p-2">
            <p className="font-switzer text-xs text-red-800">
              <span className="font-semibold">Reason: </span>
              {doc.verificationNotes}
            </p>
          </div>
        )}

        {/* Preview under status — clicks pass through to open the dialog */}
        <div className="h-48 overflow-hidden rounded-2xl border border-ash bg-white">
          {loading && (
            <div className="flex h-full items-center justify-center font-switzer text-xs text-slate-helper">
              Loading preview…
            </div>
          )}
          {!loading && error && (
            <div className="flex h-full items-center justify-center px-4 text-center font-switzer text-xs text-red-600">
              {error}
            </div>
          )}
          {!loading && url && isImageMime(doc.mimeType) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={doc.filename}
              className="pointer-events-none h-full w-full object-contain bg-[#f8fafc]"
            />
          )}
          {!loading && url && isPdfMime(doc.mimeType, doc.filename) && (
            <iframe
              src={url}
              title={doc.filename}
              className="pointer-events-none h-full w-full bg-[#f8fafc]"
            />
          )}
          {!loading &&
            url &&
            !isImageMime(doc.mimeType) &&
            !isPdfMime(doc.mimeType, doc.filename) && (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                <p className="font-switzer text-xs text-slate-helper">
                  Preview not available for this file type
                </p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="font-switzer text-xs text-nautical-teal hover:text-portrait-ink"
                >
                  Open file
                </a>
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatUploaded(value: Date) {
  return new Date(value).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatSize(fileSize: number | null) {
  return fileSize ? `${(fileSize / 1024).toFixed(1)} KB` : 'Unknown size';
}

function DocumentGridCard({
  doc,
  getPreviewUrl,
  onPreview,
}: {
  doc: DocumentWithVerification;
  getPreviewUrl: PreviewUrlFn;
  onPreview: () => void;
}) {
  const status = statusOf(doc);
  const [downloading, setDownloading] = useState(false);
  const image = isImageMime(doc.mimeType);

  const handleDownload = async () => {
    setDownloading(true);
    const result = await getPreviewUrl(doc.id);
    setDownloading(false);
    if (!result.success || !result.data?.url) return;
    const link = document.createElement('a');
    link.href = result.data.url;
    link.download = doc.filename || 'document';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <Card
      onClick={onPreview}
      className="flex h-full cursor-pointer flex-col"
    >
      <CardContent className="flex h-full flex-col gap-3">
        <div
          className={cn(
            'flex h-28 items-center justify-center rounded-2xl',
            image ? 'bg-sky-wash/70' : 'bg-peach-wash/80'
          )}
        >
          {image ? (
            <ImageIcon className="h-8 w-8 text-portrait-ink" aria-hidden />
          ) : (
            <FileText className="h-8 w-8 text-portrait-ink" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="truncate font-switzer text-sm font-semibold text-portrait-ink">
              {doc.documentType}
            </h4>
            <Badge
              variant={
                status === 'verified'
                  ? 'approved'
                  : status === 'rejected'
                    ? 'rejected'
                    : 'pending'
              }
            >
              {status === 'verified'
                ? 'Verified'
                : status === 'rejected'
                  ? 'Rejected'
                  : 'Unverified'}
            </Badge>
          </div>
          <p className="mt-1 truncate font-switzer text-xs text-slate-helper">
            {doc.filename}
          </p>
          <p className="mt-2 font-switzer text-xs text-slate-helper">
            {formatSize(doc.fileSize)} · {formatUploaded(doc.uploadedAt)}
          </p>
        </div>

        {status === 'rejected' && doc.verificationNotes && (
          <div className="rounded-lg bg-red-100 p-2">
            <p className="font-switzer text-xs text-red-800">
              <span className="font-semibold">Reason: </span>
              {doc.verificationNotes}
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onPreview();
              }}
              title="Preview"
              aria-label={`Preview ${doc.filename}`}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-full',
                'bg-sky-wash text-portrait-ink transition-colors hover:bg-sky-wash/70'
              )}
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void handleDownload();
              }}
              disabled={downloading}
              title="Download"
              aria-label={`Download ${doc.filename}`}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-full',
                'text-portrait-ink transition-colors',
                'hover:bg-sky-wash/50 disabled:cursor-not-allowed disabled:opacity-40'
              )}
            >
              <DownloadIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type ReviewDecision = 'verified' | 'reupload';

function DocumentPreviewDialog({
  doc,
  getPreviewUrl,
  onClose,
  onDocumentVerified,
  onRequestReupload,
}: {
  doc: DocumentWithVerification | null;
  getPreviewUrl: PreviewUrlFn;
  onClose: () => void;
  onDocumentVerified?: () => void;
  onRequestReupload?: (slotKey: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<ReviewDecision>('verified');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const canReview = Boolean(onDocumentVerified);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setUrl(null);

    void (async () => {
      const result = await getPreviewUrl(doc.id);
      if (cancelled) return;
      if (result.success && result.data?.url) {
        setUrl(result.data.url);
      } else {
        setError(result.message || 'Could not load preview');
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [doc, getPreviewUrl]);

  useEffect(() => {
    setDecision('verified');
    setSubmitError(null);
    setSubmitting(false);
  }, [doc?.id]);

  const handleSubmit = async () => {
    if (!doc || !canReview) return;
    if (decision === 'reupload') {
      onRequestReupload?.(doc.documentType);
      onClose();
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    const result = await verifyDocument({
      documentId: doc.id,
      verified: true,
    });
    setSubmitting(false);
    if (!result.success) {
      setSubmitError(result.message || 'Could not verify document');
      return;
    }
    onDocumentVerified?.();
    onClose();
  };

  useEffect(() => {
    if (!doc) return;
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
  }, [doc, onClose]);

  if (!doc) return null;

  const pdf = Boolean(url && isPdfMime(doc.mimeType, doc.filename));
  const image = Boolean(url && !pdf && isImageMime(doc.mimeType));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={doc.filename}
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] bg-white shadow-elevated"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ash px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-switzer text-sm font-semibold text-portrait-ink">
              {doc.documentType}
            </p>
            <p className="truncate font-switzer text-xs text-slate-helper">
              {doc.filename}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canReview && (
              <>
                <div
                  className="flex rounded-full bg-sky-wash/70 p-1"
                  role="radiogroup"
                  aria-label="Document decision"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={decision === 'verified'}
                    onClick={() => setDecision('verified')}
                    className={cn(
                      'rounded-full px-3 py-1 font-switzer text-xs font-semibold text-portrait-ink',
                      decision === 'verified' && 'bg-white shadow-card'
                    )}
                  >
                    Verified
                  </button>
                  {onRequestReupload && (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={decision === 'reupload'}
                      onClick={() => setDecision('reupload')}
                      className={cn(
                        'rounded-full px-3 py-1 font-switzer text-xs font-semibold text-portrait-ink',
                        decision === 'reupload' && 'bg-white shadow-card'
                      )}
                    >
                      Request reupload
                    </button>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting…' : 'Submit'}
                </Button>
              </>
            )}
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
        {submitError && (
          <p className="border-b border-ash px-5 py-2 font-switzer text-xs text-red-600">
            {submitError}
          </p>
        )}

        <div className="flex min-h-[50vh] flex-1 items-center justify-center bg-[#f8fafc] p-4">
          {loading && (
            <p className="font-switzer text-sm text-slate-helper">
              Loading preview…
            </p>
          )}
          {!loading && error && (
            <p className="px-4 text-center font-switzer text-sm text-red-600">
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
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex font-switzer text-sm font-medium text-nautical-teal hover:text-portrait-ink"
              >
                Open file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocumentViewer({
  documents,
  onDocumentVerified,
  getPreviewUrl = getDocumentPreviewUrl,
  onRequestReupload,
  layout = 'list',
}: DocumentViewerProps) {
  const [previewDoc, setPreviewDoc] = useState<DocumentWithVerification | null>(
    null
  );

  useEffect(() => {
    if (!previewDoc) return;
    if (!documents.some((doc) => doc.id === previewDoc.id)) {
      setPreviewDoc(null);
    }
  }, [documents, previewDoc]);

  if (documents.length === 0) {
    return (
      <div className="py-8 text-center">
        <svg
          className="mx-auto mb-3 h-12 w-12 text-slate-helper"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <p className="font-switzer text-sm text-slate-helper">
          No documents uploaded yet
        </p>
      </div>
    );
  }

  if (layout === 'grid') {
    return (
      <>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {documents.map((doc) => (
            <DocumentGridCard
              key={doc.id}
              doc={doc}
              getPreviewUrl={getPreviewUrl}
              onPreview={() => setPreviewDoc(doc)}
            />
          ))}
        </div>
        <DocumentPreviewDialog
          doc={previewDoc}
          getPreviewUrl={getPreviewUrl}
          onClose={() => setPreviewDoc(null)}
          onDocumentVerified={onDocumentVerified}
          onRequestReupload={onRequestReupload}
        />
      </>
    );
  }

  return (
    <>
      <div className="h-[58rem] overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
        <div className="flex flex-col gap-4">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              getPreviewUrl={getPreviewUrl}
              onPreview={() => setPreviewDoc(doc)}
            />
          ))}
        </div>
      </div>
      <DocumentPreviewDialog
        doc={previewDoc}
        getPreviewUrl={getPreviewUrl}
        onClose={() => setPreviewDoc(null)}
        onDocumentVerified={onDocumentVerified}
        onRequestReupload={onRequestReupload}
      />
    </>
  );
}
