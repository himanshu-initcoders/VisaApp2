import Link from 'next/link';
import { FlagLogo } from '@/components/shared/FlagLogo';
import { getCountryName, getLocalFlagUrl } from '@/lib/countries/catalog';
import { cn } from '@/lib/utils';

export type MultiCountryChipItem = {
  code: string;
  name?: string;
  flagUrl?: string | null;
  /** When set, chip links to this path (e.g. preferred visa listing). */
  href?: string | null;
};

export function MultiCountryChips({
  countries,
  className,
  chipClassName,
  size = 'md',
}: {
  countries: MultiCountryChipItem[];
  className?: string;
  chipClassName?: string;
  size?: 'sm' | 'md';
}) {
  if (countries.length === 0) return null;

  const flagSize = size === 'sm' ? 'sm' : 'md';

  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {countries.map((country) => {
        const code = country.code.trim().toUpperCase();
        const name = country.name?.trim() || getCountryName(code);
        const flagUrl = country.flagUrl ?? getLocalFlagUrl(code);
        const href = country.href?.trim() || null;

        const chipClass = cn(
          'inline-flex items-center gap-2 rounded-full border border-ash-divider/80 bg-white text-portrait-ink',
          size === 'sm' ? 'py-1 pl-1.5 pr-2.5 text-xs' : 'py-1.5 pl-2 pr-3 text-sm',
          href &&
            'transition-colors hover:border-nautical-teal/40 hover:bg-sky-wash/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nautical-teal/30',
          chipClassName
        );

        const inner = (
          <>
            <FlagLogo
              countryCode={code}
              flagUrl={flagUrl}
              alt={`${name} flag`}
              size={flagSize}
              shape="circle"
            />
            <span className="font-medium leading-none">{name}</span>
          </>
        );

        return (
          <li key={code}>
            {href ? (
              <Link href={href} className={chipClass} aria-label={`View visas for ${name}`}>
                {inner}
              </Link>
            ) : (
              <span className={chipClass}>{inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
