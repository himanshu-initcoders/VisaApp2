'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Upload, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  InitialTabs,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type { TravelerProfile } from '@/lib/dashboard/travelerProfiles';
import { replaceMyProfileDocument } from '@/app/(dashboard)/documents/actions';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

function isImageMime(mime: string | null | undefined) {
  return Boolean(mime?.startsWith('image/'));
}

function isPdfMime(mime: string | null | undefined, filename: string) {
  return mime === 'application/pdf' || /\.pdf$/i.test(filename);
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function DocumentPreview({
  url,
  mimeType,
  filename,
  className,
}: {
  url: string | null;
  mimeType: string | null;
  filename: string;
  className?: string;
}) {
  if (!url) {
    return (
      <div
        className={cn(
          'flex items-center justify-center font-switzer text-xs text-slate-helper',
          className
        )}
      >
        Preview unavailable
      </div>
    );
  }

  if (isImageMime(mimeType)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={filename}
        className={cn('bg-[#f8fafc] object-contain', className)}
      />
    );
  }

  if (isPdfMime(mimeType, filename)) {
    return (
      <iframe
        src={url}
        title={filename}
        className={cn('bg-[#f8fafc]', className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-4 text-center',
        className
      )}
    >
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
  );
}

function ReplaceDocumentDialog({
  profileId,
  doc,
  draft,
  open,
  onClose,
  onPickAnother,
}: {
  profileId: string;
  doc: TravelerProfile['documents'][number];
  draft: { file: File; previewUrl: string } | null;
  open: boolean;
  onClose: () => void;
  onPickAnother: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) setError('');
  }, [open, draft?.file.name]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, pending, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const previewUrl = draft?.previewUrl ?? null;
  const mimeType = draft?.file.type || doc.mimeType;
  const filename = draft?.file.name || doc.filename;

  const confirmUpdate = () => {
    if (!draft) return;
    setError('');
    startTransition(async () => {
      try {
        const bufferBase64 = await fileToBase64(draft.file);
        const result = await replaceMyProfileDocument({
          profileId,
          documentId: doc.documentDbId || doc.id,
          filename: draft.file.name,
          mimeType: draft.file.type || 'application/octet-stream',
          bufferBase64,
        });
        if (!result.success) {
          setError(result.message || 'Failed to update document');
          return;
        }
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Update ${doc.label}`}
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] bg-white shadow-elevated"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ash px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-switzer text-sm font-semibold text-portrait-ink">
              {doc.label}
            </p>
            <p className="truncate font-switzer text-xs text-slate-helper">
              {filename}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg p-1.5 text-slate-helper transition-colors hover:bg-sky-wash hover:text-portrait-ink disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-[45vh] flex-1 items-center justify-center bg-[#f8fafc] p-4">
          <DocumentPreview
            url={previewUrl}
            mimeType={mimeType}
            filename={filename}
            className="h-[55vh] w-full max-w-full"
          />
        </div>

        {error ? (
          <p className="px-5 pt-3 font-switzer text-sm text-[#ff4940]">{error}</p>
        ) : (
          <p className="px-5 pt-3 font-switzer text-xs text-slate-helper">
            Previous file stays on past applications. Your profile will show this
            new version.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-ash px-5 py-4">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onPickAnother}
            disabled={pending}
          >
            Choose another
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={confirmUpdate}
            disabled={pending || !draft}
          >
            <span className="inline-flex items-center gap-2">
              <Upload className="h-4 w-4 shrink-0" />
              {pending ? 'Updating…' : 'Update document'}
            </span>
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function DocumentCard({
  doc,
  onReupload,
}: {
  doc: TravelerProfile['documents'][number];
  onReupload: () => void;
}) {
  const status =
    doc.verified === true
      ? 'verified'
      : doc.verified === false
        ? 'rejected'
        : 'unverified';

  return (
    <Card
      className={cn(
        'transition-colors',
        status === 'verified' && 'bg-mint-wash/30',
        status === 'rejected' && 'bg-red-50/30',
        status === 'unverified' && 'bg-peach-wash/20'
      )}
    >
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4 className="font-switzer text-sm font-semibold text-portrait-ink">
              {doc.label}
            </h4>
            <p className="mt-1 truncate font-switzer text-xs text-slate-helper">
              {doc.filename}
            </p>
            <p className="mt-1 font-switzer text-xs text-slate-helper">
              {doc.applicationLabel}
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
                  : 'Uploaded'}
            </Badge>
            {doc.previewUrl ? (
              <a
                href={doc.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={doc.filename}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-portrait-ink transition-colors hover:bg-sky-wash/50"
                title="Open / download"
                aria-label={`Open ${doc.filename}`}
              >
                <svg
                  className="h-4 w-4"
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
              </a>
            ) : null}
          </div>
        </div>

        <div className="h-44 overflow-hidden rounded-2xl border border-ash bg-white">
          <DocumentPreview
            url={doc.previewUrl}
            mimeType={doc.mimeType}
            filename={doc.filename}
            className="h-full w-full"
          />
        </div>

        {doc.canReplace ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onReupload}
            className="w-full"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Upload className="h-4 w-4 shrink-0" />
              Reupload
            </span>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface TravelerProfilesViewProps {
  profiles: TravelerProfile[];
}

export function TravelerProfilesView({ profiles }: TravelerProfilesViewProps) {
  const items = useMemo(
    () =>
      profiles.map((p) => ({
        id: p.id,
        label: p.name,
      })),
    [profiles]
  );

  const [activeId, setActiveId] = useState(items[0]?.id ?? '');
  const active =
    profiles.find((p) => p.id === activeId) ?? profiles[0] ?? null;

  const [replaceDoc, setReplaceDoc] = useState<
    TravelerProfile['documents'][number] | null
  >(null);
  const [draft, setDraft] = useState<{ file: File; previewUrl: string } | null>(
    null
  );
  const [pickError, setPickError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    };
  }, [draft?.previewUrl]);

  if (!active) return null;

  const clearDraft = () => {
    if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    setDraft(null);
  };

  const openFilePicker = (doc: TravelerProfile['documents'][number]) => {
    setPickError('');
    setReplaceDoc(doc);
    clearDraft();
    requestAnimationFrame(() => fileInputRef.current?.click());
  };

  const onFileChosen = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file || !replaceDoc) return;

    if (!ALLOWED_MIME.has(file.type)) {
      setPickError('Upload a JPG, PNG, WEBP, or PDF');
      return;
    }
    const max =
      file.type === 'application/pdf' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size === 0 || file.size > max) {
      setPickError('File is empty or too large');
      return;
    }

    setPickError('');
    if (draft?.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    setDraft({
      file,
      previewUrl: URL.createObjectURL(file),
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeReplace = () => {
    clearDraft();
    setReplaceDoc(null);
    setPickError('');
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => onFileChosen(e.target.files)}
      />

      {items.length > 1 && (
        <InitialTabs
          items={items}
          value={active.id}
          onChange={setActiveId}
          ariaLabel="Select passenger profile"
          showActiveLabel
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>{active.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="mb-1 font-switzer text-xs text-slate-helper">
                Passport
              </dt>
              <dd className="font-switzer text-sm text-portrait-ink">
                {active.passportNumber || '—'}
              </dd>
            </div>
            <div>
              <dt className="mb-1 font-switzer text-xs text-slate-helper">
                Date of birth
              </dt>
              <dd className="font-switzer text-sm text-portrait-ink">
                {active.dateOfBirth || '—'}
              </dd>
            </div>
            <div>
              <dt className="mb-1 font-switzer text-xs text-slate-helper">
                Nationality
              </dt>
              <dd className="font-switzer text-sm text-portrait-ink">
                {active.nationality || '—'}
              </dd>
            </div>
            <div>
              <dt className="mb-1 font-switzer text-xs text-slate-helper">
                Applications
              </dt>
              <dd className="font-switzer text-sm text-portrait-ink">
                {active.applicationCount}
              </dd>
            </div>
          </dl>

          {active.applications.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {active.applications.map((app) => (
                <Link
                  key={app.id}
                  href={`/applications/visa/${app.id}`}
                  className="rounded-full border border-ash bg-sky-wash/40 px-3 py-1 font-switzer text-xs text-nautical-teal transition-colors hover:border-nautical-teal/40 hover:text-portrait-ink"
                >
                  {app.label}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 font-switzer text-sm font-semibold text-portrait-ink">
          Documents ({active.documents.length})
        </h2>
        {pickError ? (
          <p className="mb-3 font-switzer text-sm text-[#ff4940]">{pickError}</p>
        ) : null}
        {active.documents.length === 0 ? (
          <div className="rounded-[24px] border border-ash bg-white px-6 py-10 text-center">
            <p className="font-switzer text-sm text-slate-helper">
              No uploaded documents for this passenger yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {active.documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onReupload={() => openFilePicker(doc)}
              />
            ))}
          </div>
        )}
      </div>

      {replaceDoc && draft ? (
        <ReplaceDocumentDialog
          profileId={active.id}
          doc={replaceDoc}
          draft={draft}
          open
          onClose={closeReplace}
          onPickAnother={() => {
            clearDraft();
            requestAnimationFrame(() => fileInputRef.current?.click());
          }}
        />
      ) : null}
    </div>
  );
}
