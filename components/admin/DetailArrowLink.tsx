import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/**
 * Boxed arrow used to open a detail page from an admin table.
 */
export function DetailArrowLink({
  href,
  label = 'View details',
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-ash text-portrait-ink transition-colors hover:bg-sky-wash"
    >
      <ArrowRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}
