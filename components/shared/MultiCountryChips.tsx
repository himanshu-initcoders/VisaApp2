import { FlagLogo } from '@/components/shared/FlagLogo';
import { getCountryName, getLocalFlagUrl } from '@/lib/countries/catalog';
import { cn } from '@/lib/utils';

export type MultiCountryChipItem = {
  code: string;
  name?: string;
  flagUrl?: string | null;
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

        return (
          <li
            key={code}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border border-ash-divider/80 bg-white text-portrait-ink',
              size === 'sm' ? 'py-1 pl-1.5 pr-2.5 text-xs' : 'py-1.5 pl-2 pr-3 text-sm',
              chipClassName
            )}
          >
            <FlagLogo
              countryCode={code}
              flagUrl={flagUrl}
              alt={`${name} flag`}
              size={flagSize}
              shape="circle"
            />
            <span className="font-medium leading-none">{name}</span>
          </li>
        );
      })}
    </ul>
  );
}
