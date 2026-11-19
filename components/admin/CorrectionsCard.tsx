'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Eye, X } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import {
  getApplicationStoragePreviewUrl,
  resolveCorrection,
} from '@/app/(admin)/actions';
import type { CorrectionRoundView } from '@/lib/visa/corrections';

type CorrectionFileValue = {
  filename?: string | null;
  key?: string | null;
  url?: string | null;
  mimeType?: string | null;
};

type CompareTarget = {
  itemId: string;
  label: string;
  previous: CorrectionFileValue | null;
  next: CorrectionFileValue | null;
};

function isFileValue(value: unknown): value is CorrectionFileValue {
  return Boolean(
    value &&
      typeof value === 'object' &&
      ('filename' in value || 'key' in value || 'url' in value)
  );
}

function asFileValue(value: unknown): CorrectionFileValue | null {
  return isFileValue(value) ? value : null;
}

function valueText(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') return value;
  if (isFileValue(value)) return value.filename || 'File';
  return JSON.stringify(value);
}

function guessMime(
  file: CorrectionFileValue | null
): string | null {
  if (!file) return null;
  if (file.mimeType) return file.mimeType;
  const name = `${file.filename || ''} ${file.key || ''}`.toLowerCase();
  if (name.includes('.pdf')) return 'application/pdf';
  if (name.includes('.png')) return 'image/png';
  if (name.includes('.webp')) return 'image/webp';
  if (name.includes('.jpg') || name.includes('.jpeg')) return 'image/jpeg';
  return null;
}

function isImageMime(mime: string | null) {
  return Boolean(mime?.startsWith('image/'));
}

function isPdfMime(mime: string | null, filename?: string | null) {
  return mime === 'application/pdf' || /\.pdf$/i.test(filename || '');
}

function CorrectionFilePane({
  title,
  file,
  url,
  loading,
  error,
}: {
  title: string;
  file: CorrectionFileValue | null;
  url: string | null;
  loading: boolean;
  error: string;
}) {
  const mime = guessMime(file);
  const filename = file?.filename || 'File';
  const pdf = Boolean(url && isPdfMime(mime, filename));
  const image = Boolean(url && !pdf && isImageMime(mime));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-ash bg-white">
      <div className="border-b border-ash px-3 py-2">
        <p className="font-switzer text-xs font-semibold uppercase tracking-wider text-slate-helper">
          {title}
        </p>
        <p className="truncate font-switzer text-sm text-portrait-ink">
          {file ? filename : '—'}
        </p>
      </div>
      <div className="flex min-h-[40vh] flex-1 items-center justify-center bg-[#f8fafc] p-3">
        {!file && (
          <p className="font-switzer text-sm text-slate-helper">No file</p>
        )}
        {file && loading && (
          <p className="font-switzer text-sm text-slate-helper">
            Loading preview…
          </p>
        )}
        {file && !loading && error && (
          <p className="px-2 text-center font-switzer text-sm text-[#ff4940]">
            {error}
          </p>
        )}
        {file && !loading && !error && url && image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={filename}
            className="max-h-[55vh] max-w-full object-contain"
          />
        )}
        {file && !loading && !error && url && pdf && (
          <iframe
            title={filename}
            src={url}
            className="h-[55vh] w-full rounded-xl bg-white"
          />
        )}
        {file && !loading && !error && url && !image && !pdf && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-switzer text-sm font-medium text-nautical-teal hover:text-portrait-ink"
          >
            Open file
          </a>
        )}
        {file && !loading && !error && !url && (
          <p className="font-switzer text-sm text-slate-helper">
            Preview unavailable
          </p>
        )}
      </div>
    </div>
  );
}

function DocumentCompareDialog({
  applicationId,
  applicationType,
  target,
  onClose,
}: {
  applicationId: string;
  applicationType: 'visa' | 'passport';
  target: CompareTarget;
  onClose: () => void;
}) {
  const [previousUrl, setPreviousUrl] = useState<string | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [previousLoading, setPreviousLoading] = useState(false);
  const [nextLoading, setNextLoading] = useState(false);
  const [previousError, setPreviousError] = useState('');
  const [nextError, setNextError] = useState('');

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

  useEffect(() => {
    let cancelled = false;

    const load = async (
      file: CorrectionFileValue | null,
      setUrl: (url: string | null) => void,
      setLoading: (value: boolean) => void,
      setError: (value: string) => void
    ) => {
      const key = file?.key?.trim();
      if (!key) {
        setUrl(file?.url?.trim() || null);
        setLoading(false);
        setError('');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const result = await getApplicationStoragePreviewUrl({
          applicationId,
          applicationType,
          storageKey: key,
        });
        if (cancelled) return;
        if (!result.success || !result.data?.url) {
          const fallback = file?.url?.trim() || null;
          setUrl(fallback);
          setError(
            fallback ? '' : result.message || 'Could not load preview'
          );
          return;
        }
        setUrl(result.data.url);
      } catch {
        if (!cancelled) {
          const fallback = file?.url?.trim() || null;
          setUrl(fallback);
          setError(fallback ? '' : 'Could not load preview');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load(
      target.previous,
      setPreviousUrl,
      setPreviousLoading,
      setPreviousError
    );
    void load(target.next, setNextUrl, setNextLoading, setNextError);

    return () => {
      cancelled = true;
    };
  }, [applicationId, applicationType, target]);

  if (typeof document === 'undefined') return null;

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
        aria-label={`Compare ${target.label}`}
        className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] bg-white shadow-elevated"
      >
        <div className="flex items-start justify-between gap-3 border-b border-ash px-5 py-4">
          <div className="min-w-0">
            <p className="font-switzer text-sm font-semibold text-portrait-ink">
              Compare document
            </p>
            <p className="truncate font-switzer text-xs text-slate-helper">
              {target.label}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-helper transition-colors hover:bg-sky-wash hover:text-portrait-ink"
            aria-label="Close compare"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 md:grid-cols-2">
          <CorrectionFilePane
            title="Previous"
            file={target.previous}
            url={previousUrl}
            loading={previousLoading}
            error={previousError}
          />
          <CorrectionFilePane
            title="New"
            file={target.next}
            url={nextUrl}
            loading={nextLoading}
            error={nextError}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}

export function CorrectionsCard({
  rounds,
  applicationId,
  applicationType = 'visa',
}: {
  rounds: CorrectionRoundView[];
  applicationId: string;
  applicationType?: 'visa' | 'passport';
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [compare, setCompare] = useState<CompareTarget | null>(null);

  if (rounds.length === 0) return null;

  const accept = async (requestId: string) => {
    setError('');
    setPendingId(requestId);
    try {
      const result = await resolveCorrection({ requestId });
      if (!result.success) {
        setError(result.message || 'Could not accept the updates');
        return;
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Corrections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {rounds.map((round) => (
            <section key={round.id} className="space-y-3">
              <div>
                <p className="font-switzer text-sm font-semibold text-portrait-ink">
                  {round.travellerName} · {round.status.replace(/_/g, ' ')}
                </p>
                <p className="mt-1 font-switzer text-sm text-slate-helper">
                  {round.message}
                </p>
              </div>
              <ul className="space-y-2">
                {round.items.map((item) => {
                  const previousFile = asFileValue(item.previousValue);
                  const nextFile = asFileValue(item.newValue);
                  const isDocument =
                    item.kind === 'document' ||
                    Boolean(previousFile || nextFile);
                  const canCompare =
                    isDocument &&
                    item.status !== 'open' &&
                    Boolean(previousFile || nextFile);

                  return (
                    <li
                      key={item.id}
                      className="rounded-2xl border border-ash px-3 py-2 font-switzer text-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-portrait-ink">
                            {item.label}{' '}
                            <span className="font-normal text-slate-helper">
                              · {item.status.replace(/_/g, ' ')}
                            </span>
                          </p>
                          <p className="mt-1 text-slate-helper">{item.comment}</p>
                          {item.status !== 'open' && !isDocument && (
                            <p className="mt-2 text-portrait-ink">
                              {valueText(item.previousValue)} →{' '}
                              {valueText(item.newValue)}
                            </p>
                          )}
                          {item.status !== 'open' && isDocument && (
                            <p className="mt-2 text-portrait-ink">
                              {valueText(item.previousValue)} →{' '}
                              {valueText(item.newValue)}
                            </p>
                          )}
                        </div>
                        {canCompare && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setCompare({
                                itemId: item.id,
                                label: item.label,
                                previous: previousFile,
                                next: nextFile,
                              })
                            }
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Eye className="h-4 w-4 shrink-0" />
                              Compare
                            </span>
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {round.status === 'resubmitted' && (
                <Button
                  type="button"
                  variant="primary"
                  disabled={pendingId === round.id}
                  onClick={() => accept(round.id)}
                >
                  {pendingId === round.id ? 'Accepting…' : 'Accept updates'}
                </Button>
              )}
            </section>
          ))}
          {error && (
            <p className="font-switzer text-sm text-[#ff4940]" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
      {compare && (
        <DocumentCompareDialog
          applicationId={applicationId}
          applicationType={applicationType}
          target={compare}
          onClose={() => setCompare(null)}
        />
      )}
    </>
  );
}
