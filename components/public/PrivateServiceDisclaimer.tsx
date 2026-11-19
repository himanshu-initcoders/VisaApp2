import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { BRAND_NAME } from '@/components/shared/Logo';
import { PASSPORT_SEVA_URL } from '@/lib/passport/constants';
import { cn } from '@/lib/utils';

export type PrivateServiceDisclaimerVariant =
  | 'passport'
  | 'passport-compact'
  | 'general'
  | 'footer';

interface PrivateServiceDisclaimerProps {
  variant?: PrivateServiceDisclaimerVariant;
  className?: string;
}

/**
 * Trust / compliance copy: Viserv is a private paid assistance service,
 * not a government body. Passport variant points people to Passport Seva.
 */
export function PrivateServiceDisclaimer({
  variant = 'general',
  className,
}: PrivateServiceDisclaimerProps) {
  if (variant === 'footer') {
    return (
      <p
        className={cn(
          'max-w-3xl text-center text-xs leading-5 text-white/55 md:text-left',
          className
        )}
      >
        {BRAND_NAME} is a private assistance service and is not affiliated with
        the Government of India, Passport Seva, or any embassy or consulate. You
        can apply directly on official government portals; our service fee pays
        for guided help.
      </p>
    );
  }

  if (variant === 'passport-compact') {
    return (
      <p className={cn('text-xs leading-5 text-slate-helper', className)}>
        {BRAND_NAME} is a private assistance service — not Passport Seva or any
        government body.         You can apply free of our fee on{' '}
        <a
          href={PASSPORT_SEVA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-portrait-ink underline decoration-portrait-ink/30 underline-offset-2 hover:decoration-portrait-ink"
        >
          Passport Seva
        </a>
        . Our fee covers guided support.
      </p>
    );
  }

  if (variant === 'passport') {
    return (
      <aside
        role="note"
        aria-label="Not a government website"
        className={cn(
          'rounded-[24px] border border-ash-divider bg-peach-wash/70 px-5 py-4 sm:rounded-[28px] sm:px-6 sm:py-5',
          className
        )}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-portrait-ink/70">
          Independent private service
        </p>
        <p className="mt-2 text-xs text-portrait-ink">
          {BRAND_NAME} is <strong>not</strong> affiliated with the Government of
          India, the Ministry of External Affairs, or Passport Seva. Indians can
          apply directly on the official{' '}
          <a
            href={PASSPORT_SEVA_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline decoration-portrait-ink/35 underline-offset-2 hover:decoration-portrait-ink"
          >
            Passport Seva portal
            <ExternalLink
              className="ml-1 inline h-3.5 w-3.5 align-[-2px]"
              aria-hidden
            />
          </a>{' '}
          and pay only the government fee. If you use us, you pay an additional
          service fee for document guidance, form help, and application support.
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-helper">
          See our{' '}
          <Link
            href="/terms#what-we-do"
            className="font-medium text-portrait-ink underline decoration-portrait-ink/30 underline-offset-2 hover:decoration-portrait-ink"
          >
            Terms
          </Link>{' '}
          for the full description of our role.
        </p>
      </aside>
    );
  }

  // general — visa listings / checkout
  return (
    <aside
      role="note"
      aria-label="Not a government website"
      className={cn(
        'rounded-[20px] border border-ash-divider bg-sky-wash/50 px-4 py-3 text-xs leading-5 text-slate-helper sm:text-sm sm:leading-6',
        className
      )}
    >
      {BRAND_NAME} is a private assistance service and is not affiliated with any
      government, embassy, or consulate. Many visas can be applied for directly
      on the official portal for the government fee only; our service fee pays
      for review and support.
    </aside>
  );
}
