'use client';

import {
  useState,
  useEffect,
  useRef,
  useId,
  type KeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FlagLogo } from '@/components/shared/FlagLogo';
import { Globe, Plus, Search, X } from 'lucide-react';
import {
  addMultiTripCountry,
  removeMultiTripCountry,
} from '@/app/(admin)/admin/config/visa-listings/actions';
import {
  getCountryName,
  getLocalFlagUrl,
  searchCountries,
  type CatalogCountry,
} from '@/lib/countries/catalog';
import { cn } from '@/lib/utils';

interface MultiCountry {
  id: string;
  visaListingId: string;
  additionalCountryCode: string;
  createdAt: Date;
}

interface Country {
  name: string;
  iso2Code: string;
}

interface MultiCountryManagerProps {
  processId: string;
  initialCountries: MultiCountry[];
  primaryCountry: Country;
}

function CountryChip({
  code,
  name,
  onRemove,
  removing,
}: {
  code: string;
  name: string;
  onRemove?: () => void;
  removing?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-ash-divider bg-white py-1.5 pl-2 pr-2 text-sm text-portrait-ink shadow-[0_1px_2px_rgba(8,48,76,0.04)]',
        removing && 'opacity-50'
      )}
    >
      <FlagLogo
        countryCode={code}
        flagUrl={getLocalFlagUrl(code)}
        alt={`${name} flag`}
        size="sm"
        shape="circle"
      />
      <span className="font-medium leading-none">{name}</span>
      <span className="text-xs uppercase text-slate-helper">{code}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-helper transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed"
          aria-label={`Remove ${name}`}
        >
          <X className="h-3.5 w-3.5 shrink-0" />
        </button>
      ) : null}
    </span>
  );
}

export function MultiCountryManager({
  processId,
  initialCountries,
  primaryCountry,
}: MultiCountryManagerProps) {
  const router = useRouter();
  const listboxId = useId();
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [countries, setCountries] = useState(initialCountries);
  const [isAdding, setIsAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogCountry[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [addingCode, setAddingCode] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCountries(initialCountries);
  }, [initialCountries]);

  useEffect(() => {
    if (!isAdding) return;
    const exclude = [
      primaryCountry.iso2Code,
      ...countries.map((c) => c.additionalCountryCode),
    ];
    setResults(searchCountries(query, { excludeCodes: exclude, limit: 10 }));
    setActiveIndex(0);
  }, [query, countries, primaryCountry.iso2Code, isAdding]);

  useEffect(() => {
    if (!isAdding) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!searchWrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isAdding]);

  const startAdding = () => {
    setIsAdding(true);
    setQuery('');
    setError(null);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setQuery('');
    setResults([]);
    setOpen(false);
    setError(null);
  };

  const handleSelect = async (country: CatalogCountry) => {
    const code = country.code.toUpperCase();
    if (addingCode) return;

    setError(null);
    setAddingCode(code);

    const result = await addMultiTripCountry(processId, {
      additionalCountryCode: code,
    });

    setAddingCode(null);

    if (result.success) {
      setQuery('');
      setOpen(true);
      inputRef.current?.focus();
      router.refresh();
    } else {
      setError(result.error || 'Failed to add country');
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    const result = await removeMultiTripCountry(deletingId);
    if (result.success) {
      setDeletingId(null);
      router.refresh();
    } else {
      setError(result.error || 'Failed to remove country');
      setDeletingId(null);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = results[activeIndex];
      if (pick) void handleSelect(pick);
    } else if (e.key === 'Escape') {
      if (query) {
        setQuery('');
      } else {
        cancelAdding();
      }
    }
  };

  const searchPanel = isAdding ? (
    <div
      ref={searchWrapRef}
      className="relative mb-6 rounded-3xl bg-sky-wash/30 p-6"
    >
      <h4 className="mb-1 text-sm font-medium text-portrait-ink">
        Add additional countries
      </h4>
      <p className="mb-4 text-sm text-slate-helper">
        Search by name or ISO code, then select to add as a chip. Primary
        destination ({primaryCountry.name}) is excluded.
      </p>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-helper" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setError(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search countries (e.g. Korea, VN, Malaysia)…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          className="w-full rounded-2xl border border-portrait-ink/15 bg-white py-3 pl-10 pr-4 text-sm text-portrait-ink outline-none transition focus:border-nautical-teal focus:ring-2 focus:ring-nautical-teal/20"
        />

        {open ? (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-ash-divider bg-white py-1 shadow-[0_8px_24px_rgba(8,48,76,0.08)]"
          >
            {results.length === 0 ? (
              <li className="px-4 py-3 text-sm text-slate-helper">
                {query.trim()
                  ? `No countries match “${query.trim()}”`
                  : 'No more countries available to add'}
              </li>
            ) : (
              results.map((country, index) => {
                const code = country.code.toUpperCase();
                const busy = addingCode === code;
                return (
                  <li key={country.code} role="option" aria-selected={index === activeIndex}>
                    <button
                      type="button"
                      disabled={!!addingCode}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => void handleSelect(country)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors disabled:opacity-60',
                        index === activeIndex
                          ? 'bg-sky-wash/60 text-portrait-ink'
                          : 'text-portrait-ink hover:bg-sky-wash/40'
                      )}
                    >
                      <FlagLogo
                        countryCode={code}
                        flagUrl={getLocalFlagUrl(code)}
                        alt={`${country.name} flag`}
                        size="sm"
                        shape="circle"
                      />
                      <span className="flex-1 font-medium">{country.name}</span>
                      <span className="text-xs uppercase text-slate-helper">
                        {busy ? 'Adding…' : code}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Button onClick={cancelAdding} variant="ghost" size="md">
          Done
        </Button>
      </div>
    </div>
  ) : null;

  const chips = (
    <div className="flex flex-wrap gap-2">
      {countries.map((country) => {
        const code = country.additionalCountryCode.toUpperCase();
        const name = getCountryName(code);
        return (
          <CountryChip
            key={country.id}
            code={code}
            name={name}
            removing={deletingId === country.id}
            onRemove={() => setDeletingId(country.id)}
          />
        );
      })}
    </div>
  );

  if (countries.length === 0 && !isAdding) {
    return (
      <>
        <EmptyState
          icon={<Globe className="h-12 w-12" />}
          title="No multi-country support configured"
          description={`This visa is currently only valid for ${primaryCountry.name}. Add additional countries to enable multi-country support.`}
          action={{
            label: 'Add Country',
            onClick: startAdding,
          }}
        />
        <ConfirmDialog
          open={deletingId !== null}
          onClose={() => setDeletingId(null)}
          onConfirm={handleDelete}
          title="Remove Country"
          message="Are you sure you want to remove this country from multi-trip support?"
          confirmText="Remove Country"
          destructive
        />
      </>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-slate-helper">
          Also valid for {countries.length} additional{' '}
          {countries.length === 1 ? 'country' : 'countries'}
        </p>
        {!isAdding ? (
          <Button onClick={startAdding} variant="primary" size="md">
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4 shrink-0" />
              Add Country
            </span>
          </Button>
        ) : null}
      </div>

      {countries.length > 0 ? (
        <div className="mb-6 rounded-3xl bg-mint-wash/30 p-6">
          <p className="text-sm font-medium text-portrait-ink">
            Marketing preview:{' '}
            <span className="text-nautical-teal">
              1 visa for {countries.length + 1} countries!
            </span>
          </p>
        </div>
      ) : null}

      {searchPanel}

      {countries.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-helper">
            Included countries
          </p>
          {chips}
        </div>
      ) : (
        <p className="text-sm text-slate-helper">
          No additional countries yet — search above to add the first one.
        </p>
      )}

      {error && !isAdding ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Remove Country"
        message="Are you sure you want to remove this country from multi-trip support?"
        confirmText="Remove Country"
        destructive
      />
    </>
  );
}
