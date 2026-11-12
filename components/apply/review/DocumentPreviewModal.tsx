'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Loader2, X } from 'lucide-react';
import { sniffFileKind } from '@/lib/apply/sniffFileType';

export interface DocumentPreviewItem {
  title: string;
  name?: string;
  previewUrl: string;
  mimeType?: string;
}

interface DocumentPreviewModalProps {
  open: boolean;
  item: DocumentPreviewItem | null;
  onClose: () => void;
}

type ViewerState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      kind: 'image' | 'pdf' | 'other';
      url: string;
      /** Object URLs owned by the modal (revoked on close). */
      owned: string[];
    };

/**
 * Load bytes, sniff real type, and keep a modal-owned object URL.
 * PDFs stay as application/pdf for a full iframe viewer (all pages).
 * First-page rasterization is only for card thumbnails, not this dialog.
 */
async function buildViewer(
  sourceUrl: string,
  mimeHint?: string,
  filename?: string
): Promise<ViewerState> {
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      if (sourceUrl.startsWith('blob:') || sourceUrl.startsWith('data:')) {
        const hint = (mimeHint || '').toLowerCase();
        const kind =
          hint.includes('pdf') || /\.pdf$/i.test(filename || '')
            ? 'pdf'
            : hint.startsWith('image/')
              ? 'image'
              : 'other';
        return { status: 'ready', kind, url: sourceUrl, owned: [] };
      }
      return { status: 'error' };
    }

    const buffer = await response.arrayBuffer();
    const sniffed = sniffFileKind(
      buffer,
      mimeHint || response.headers.get('content-type') || undefined,
      filename
    );
    const sourceBlob = new Blob([buffer], { type: sniffed.mimeType });
    const sourceObjectUrl = URL.createObjectURL(sourceBlob);

    if (sniffed.kind === 'pdf') {
      return {
        status: 'ready',
        kind: 'pdf',
        url: sourceObjectUrl,
        owned: [sourceObjectUrl],
      };
    }

    if (sniffed.kind === 'image') {
      return {
        status: 'ready',
        kind: 'image',
        url: sourceObjectUrl,
        owned: [sourceObjectUrl],
      };
    }

    return {
      status: 'ready',
      kind: 'other',
      url: sourceObjectUrl,
      owned: [sourceObjectUrl],
    };
  } catch {
    return { status: 'error' };
  }
}

export function DocumentPreviewModal({
  open,
  item,
  onClose,
}: DocumentPreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  const [viewer, setViewer] = useState<ViewerState>({ status: 'loading' });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !item?.previewUrl) {
      setViewer({ status: 'error' });
      return;
    }

    let cancelled = false;
    const ownedRef: { current: string[] } = { current: [] };
    setViewer({ status: 'loading' });

    void (async () => {
      const next = await buildViewer(
        item.previewUrl,
        item.mimeType,
        item.name
      );
      if (cancelled) {
        if (next.status === 'ready') {
          for (const url of next.owned) URL.revokeObjectURL(url);
        }
        return;
      }
      if (next.status === 'ready') ownedRef.current = next.owned;
      setViewer(next);
    })();

    return () => {
      cancelled = true;
      for (const url of ownedRef.current) URL.revokeObjectURL(url);
      ownedRef.current = [];
    };
  }, [open, item?.previewUrl, item?.mimeType, item?.name]);

  if (!mounted || !open || !item) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] bg-white shadow-elevated"
      >
        <div className="flex items-center justify-between gap-3 border-b border-ash px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-switzer text-sm font-semibold text-portrait-ink">
              {item.title}
            </p>
            {item.name && (
              <p className="truncate text-xs text-slate-helper">{item.name}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-helper transition-colors hover:bg-sky-wash hover:text-portrait-ink"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center bg-[#f8fafc] p-4">
          {viewer.status === 'loading' ? (
            <Loader2 className="h-8 w-8 animate-spin text-slate-helper" />
          ) : viewer.status === 'error' ? (
            <p className="text-sm text-slate-helper">
              Could not load this file. Re-save the draft or re-upload the
              document, then try View again.
            </p>
          ) : viewer.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={viewer.url}
              alt={item.title}
              className="max-h-[75vh] max-w-full object-contain"
            />
          ) : viewer.kind === 'pdf' ? (
            <iframe
              title={item.title}
              src={`${viewer.url}#view=FitH`}
              className="h-[75vh] w-full rounded-2xl bg-white"
            />
          ) : (
            <div className="text-center">
              <FileText className="mx-auto h-10 w-10 text-slate-helper" />
              <p className="mt-3 text-sm text-portrait-ink">
                Preview isn&apos;t available for this file type.
              </p>
              <a
                href={viewer.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex text-sm font-medium text-[#3b82f6] hover:underline"
              >
                Open file
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
