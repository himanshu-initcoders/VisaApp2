'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, Badge } from '@/components/ui';
import { getDocumentPreviewUrl } from '@/app/(admin)/actions';
import type { ActionResponse, DocumentWithVerification } from '@/types/admin';
import { cn } from '@/lib/utils';

/**
 * Document Viewer — list + inline preview + download.
 * Verify/Reject actions hidden for now.
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
  onRequestReupload,
}: {
  doc: DocumentWithVerification;
  getPreviewUrl: PreviewUrlFn;
  onRequestReupload?: (slotKey: string) => void;
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
      className={cn(
        'transition-colors',
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
              onClick={handleDownload}
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
        {onRequestReupload && (
          <button
            type="button"
            onClick={() => onRequestReupload(doc.documentType)}
            className="font-switzer text-xs font-semibold text-nautical-teal hover:text-portrait-ink"
          >
            Request reupload
          </button>
        )}

        {/* Preview under status — fixed preview height */}
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
              className="h-full w-full object-contain bg-[#f8fafc]"
            />
          )}
          {!loading && url && isPdfMime(doc.mimeType, doc.filename) && (
            <iframe
              src={url}
              title={doc.filename}
              className="h-full w-full bg-[#f8fafc]"
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

export function DocumentViewer({
  documents,
  getPreviewUrl = getDocumentPreviewUrl,
  onRequestReupload,
}: DocumentViewerProps) {
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

  return (
    <div className="h-[58rem] overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
      <div className="flex flex-col gap-4">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            getPreviewUrl={getPreviewUrl}
            onRequestReupload={onRequestReupload}
          />
        ))}
      </div>
    </div>
  );
}
