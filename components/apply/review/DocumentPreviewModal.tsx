'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

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

export function DocumentPreviewModal({
  open,
  item,
  onClose,
}: DocumentPreviewModalProps) {
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

  if (!open || !item) return null;

  const isImage = Boolean(
    item.mimeType?.startsWith('image/') ||
      /^data:image\//.test(item.previewUrl) ||
      /\.(jpe?g|png|webp|gif)$/i.test(item.name || item.previewUrl)
  );
  const isPdf = Boolean(
    item.mimeType === 'application/pdf' ||
      /^data:application\/pdf/.test(item.previewUrl) ||
      /\.pdf$/i.test(item.name || item.previewUrl)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
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
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.previewUrl}
              alt={item.title}
              className="max-h-[75vh] max-w-full object-contain"
            />
          ) : isPdf ? (
            <iframe
              title={item.title}
              src={item.previewUrl}
              className="h-[75vh] w-full rounded-2xl bg-white"
            />
          ) : (
            <div className="text-center">
              <p className="text-sm text-portrait-ink">
                Preview isn&apos;t available for this file type.
              </p>
              <a
                href={item.previewUrl}
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
    </div>
  );
}
