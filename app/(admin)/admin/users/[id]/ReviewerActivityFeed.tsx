import Link from 'next/link';
import { Badge, getStatusVariant, Card } from '@/components/ui';
import type { ReviewerActivityItem } from '@/types/admin';

const KIND_LABEL = {
  call: 'Call log',
  note: 'Note',
  status: 'Status change',
} as const;

function formatWhen(value: Date): string {
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ReviewerActivityFeed({
  items,
}: {
  items: ReviewerActivityItem[];
}) {
  if (items.length === 0) {
    return (
      <Card className="py-12">
        <p className="text-center font-switzer text-sm text-slate-helper">
          No activity yet
        </p>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <ul className="divide-y divide-ash">
        {items.map((item) => (
          <li key={item.id} className="px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-switzer text-xs font-semibold uppercase tracking-wider text-slate-helper">
                {KIND_LABEL[item.kind]}
              </span>
              <span className="font-switzer text-xs text-slate-helper">
                {formatWhen(item.createdAt)}
              </span>
            </div>

            <Link
              href={`/admin/applications/${item.applicationType}/${item.applicationId}`}
              className="mt-1 inline-block font-switzer text-sm font-medium text-nautical-teal transition-colors hover:text-portrait-ink"
            >
              {item.applicationLabel}
            </Link>

            {item.kind === 'status' ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={getStatusVariant(item.oldStatus || '')}>
                  {item.oldStatus || '—'}
                </Badge>
                <span className="font-switzer text-xs text-slate-helper">to</span>
                <Badge variant={getStatusVariant(item.newStatus || '')}>
                  {item.newStatus}
                </Badge>
              </div>
            ) : null}

            {item.phone ? (
              <p className="mt-2 font-switzer text-sm text-portrait-ink">
                {item.phone}
              </p>
            ) : null}

            {item.body ? (
              <p className="mt-2 whitespace-pre-wrap font-switzer text-sm text-portrait-ink">
                {item.body}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
