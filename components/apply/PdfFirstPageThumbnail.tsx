'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { createPdfFirstPagePreviewUrl } from '@/lib/apply/pdfFirstPagePreview';

interface PdfFirstPageThumbnailProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallbackName?: string;
}

/**
 * Renders PDF page 1 as an image so document cards match photo previews.
 */
export function PdfFirstPageThumbnail({
  src,
  alt,
  className,
  imgClassName,
  fallbackName,
}: PdfFirstPageThumbnailProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const thumbRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setThumbUrl(null);

    void (async () => {
      const next = await createPdfFirstPagePreviewUrl(src);
      if (cancelled) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      if (!next) {
        setStatus('error');
        return;
      }
      if (thumbRef.current) URL.revokeObjectURL(thumbRef.current);
      thumbRef.current = next;
      setThumbUrl(next);
      setStatus('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    return () => {
      if (thumbRef.current) {
        URL.revokeObjectURL(thumbRef.current);
        thumbRef.current = null;
      }
    };
  }, []);

  if (status === 'loading') {
    return (
      <div
        className={
          className ?? 'flex h-full w-full items-center justify-center'
        }
      >
        <Loader2 className="h-6 w-6 animate-spin text-slate-helper" />
      </div>
    );
  }

  if (status === 'error' || !thumbUrl) {
    return (
      <div
        className={
          className ??
          'flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center'
        }
      >
        <FileText className="h-8 w-8 text-slate-helper" />
        {fallbackName ? (
          <p className="line-clamp-2 text-xs text-portrait-ink">{fallbackName}</p>
        ) : null}
        <p className="text-[11px] text-slate-helper">PDF</p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={thumbUrl} alt={alt} className={imgClassName} />
  );
}
