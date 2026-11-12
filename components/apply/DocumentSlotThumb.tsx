'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { PdfFirstPageThumbnail } from '@/components/apply/PdfFirstPageThumbnail';
import { resolveDocumentPreviewUrl } from '@/lib/apply/resolveDocumentPreview';
import { sniffFileKind } from '@/lib/apply/sniffFileType';

interface DocumentSlotThumbProps {
  title: string;
  previewUrl?: string;
  storageUrl?: string;
  storageKey?: string;
  mimeType?: string;
  filename?: string;
  listingId?: string;
  travellerId?: string;
  slotKey?: string;
  ownerUserId?: string | null;
  sessionUserId?: string | null;
  className?: string;
  imgClassName?: string;
}

type ThumbState =
  | { status: 'loading' }
  | { status: 'error'; label?: string }
  | { status: 'image'; url: string }
  | { status: 'pdf'; url: string; label?: string };

/**
 * Documents-tab thumbnail that re-resolves after refresh and sniffs bytes
 * so a PDF is never rendered with a raw <img> (broken-image icon).
 */
export function DocumentSlotThumb({
  title,
  previewUrl,
  storageUrl,
  storageKey,
  mimeType,
  filename,
  listingId,
  travellerId,
  slotKey,
  ownerUserId,
  sessionUserId,
  className,
  imgClassName,
}: DocumentSlotThumbProps) {
  const [state, setState] = useState<ThumbState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    void (async () => {
      const resolved = await resolveDocumentPreviewUrl({
        listingId,
        travellerId,
        slotKey,
        storageKey,
        ownerUserId: ownerUserId ?? undefined,
        sessionUserId,
        previewUrl,
        storageUrl,
        filename,
      });

      if (cancelled) return;

      if (!resolved?.url) {
        setState({ status: 'error', label: filename || title });
        return;
      }

      try {
        const response = await fetch(resolved.url);
        if (!response.ok) throw new Error('unreachable');
        const buffer = await response.arrayBuffer();
        const sniffed = sniffFileKind(
          buffer,
          resolved.mimeType || mimeType,
          filename
        );

        if (cancelled) return;

        if (sniffed.kind === 'pdf') {
          setState({
            status: 'pdf',
            url: resolved.url,
            label: filename || 'PDF',
          });
          return;
        }

        if (sniffed.kind === 'image') {
          setState({ status: 'image', url: resolved.url });
          return;
        }

        setState({ status: 'error', label: filename || title });
      } catch {
        if (cancelled) return;
        // Fall back on declared mime / filename when fetch sniff fails.
        const declared = (resolved.mimeType || mimeType || '').toLowerCase();
        if (declared.includes('pdf') || /\.pdf$/i.test(filename || '')) {
          setState({
            status: 'pdf',
            url: resolved.url,
            label: filename || 'PDF',
          });
        } else if (declared.startsWith('image/')) {
          setState({ status: 'image', url: resolved.url });
        } else {
          setState({ status: 'error', label: filename || title });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    previewUrl,
    storageUrl,
    storageKey,
    mimeType,
    filename,
    listingId,
    travellerId,
    slotKey,
    ownerUserId,
    sessionUserId,
    title,
  ]);

  if (state.status === 'loading') {
    return (
      <div
        className={
          className ??
          'mt-3 flex max-h-40 min-h-[10rem] items-center justify-center rounded-2xl bg-[#f8fafc]'
        }
      >
        <Loader2 className="h-6 w-6 animate-spin text-slate-helper" />
      </div>
    );
  }

  if (state.status === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={state.url}
        alt={title}
        className={
          imgClassName ??
          'mt-3 max-h-40 w-full rounded-2xl object-contain bg-[#f8fafc]'
        }
      />
    );
  }

  if (state.status === 'pdf') {
    return (
      <div
        className={
          className ??
          'mt-3 flex max-h-40 min-h-[10rem] items-center justify-center overflow-hidden rounded-2xl bg-[#f8fafc]'
        }
      >
        <PdfFirstPageThumbnail
          src={state.url}
          alt={title}
          fallbackName={state.label}
          className="flex min-h-[10rem] w-full flex-col items-center justify-center gap-2 px-4 text-center"
          imgClassName={
            imgClassName ?? 'max-h-40 w-full object-contain p-2'
          }
        />
      </div>
    );
  }

  return (
    <div
      className={
        className ??
        'mt-3 flex min-h-[10rem] flex-col items-center justify-center gap-2 rounded-2xl bg-[#f8fafc] px-4 text-center'
      }
    >
      <FileText className="h-8 w-8 text-slate-helper" />
      <p className="line-clamp-2 text-xs text-portrait-ink">
        {state.label || 'Document uploaded'}
      </p>
    </div>
  );
}
