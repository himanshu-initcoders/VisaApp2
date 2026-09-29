'use client';

import { useMemo, useState } from 'react';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  InitialTabs,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import type { PassengerProfile } from '@/lib/dashboard/passengerProfiles';
import Link from 'next/link';

function isImageMime(mime: string | null | undefined) {
  return Boolean(mime?.startsWith('image/'));
}

function isPdfMime(mime: string | null | undefined, filename: string) {
  return mime === 'application/pdf' || /\.pdf$/i.test(filename);
}

function DocumentCard({
  doc,
}: {
  doc: PassengerProfile['documents'][number];
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
          {!doc.previewUrl && (
            <div className="flex h-full items-center justify-center font-switzer text-xs text-slate-helper">
              Preview unavailable
            </div>
          )}
          {doc.previewUrl && isImageMime(doc.mimeType) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={doc.previewUrl}
              alt={doc.filename}
              className="h-full w-full bg-[#f8fafc] object-contain"
            />
          )}
          {doc.previewUrl && isPdfMime(doc.mimeType, doc.filename) && (
            <iframe
              src={doc.previewUrl}
              title={doc.filename}
              className="h-full w-full bg-[#f8fafc]"
            />
          )}
          {doc.previewUrl &&
            !isImageMime(doc.mimeType) &&
            !isPdfMime(doc.mimeType, doc.filename) && (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                <p className="font-switzer text-xs text-slate-helper">
                  Preview not available for this file type
                </p>
                <a
                  href={doc.previewUrl}
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

interface PassengerProfilesViewProps {
  profiles: PassengerProfile[];
}

export function PassengerProfilesView({ profiles }: PassengerProfilesViewProps) {
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

  if (!active) return null;

  return (
    <div className="space-y-6">
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
        {active.documents.length === 0 ? (
          <div className="rounded-[24px] border border-ash bg-white px-6 py-10 text-center">
            <p className="font-switzer text-sm text-slate-helper">
              No uploaded documents for this passenger yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {active.documents.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
