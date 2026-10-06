import Link from 'next/link';
import type { ApplicantActionItem } from '@/lib/visa/corrections';

export function ActionRequiredBanner({
  items,
}: {
  items: ApplicantActionItem[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <section
          key={`${item.applicationId}-${item.travellerId}`}
          className="rounded-[24px] border border-[#f3c9a0] bg-peach-wash px-5 py-4"
        >
          <p className="font-switzer text-xs font-semibold uppercase tracking-wider text-portrait-ink">
            Action needed
          </p>
          <h2 className="mt-1 font-basier text-2xl text-portrait-ink">
            {item.country} — {item.visaType}
          </h2>
          <p className="mt-1 font-switzer text-sm text-portrait-ink">
            {item.travellerName}: {item.message}
          </p>
          <ul className="mt-3 space-y-1">
            {item.items.map((change) => (
              <li
                key={change.targetKey}
                className="font-switzer text-sm text-portrait-ink"
              >
                <span className="font-semibold">{change.label}.</span>{' '}
                {change.comment}
              </li>
            ))}
          </ul>
          <Link
            href={`/applications/visa/${item.applicationId}/fix?traveller=${item.travellerId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex rounded-full border border-portrait-ink px-4 py-2 font-switzer text-sm font-semibold text-portrait-ink"
          >
            Fix now
          </Link>
        </section>
      ))}
    </div>
  );
}
