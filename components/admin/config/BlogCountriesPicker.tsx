'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FlagLogo } from '@/components/shared/FlagLogo';
import { Globe, Plus, Search, X } from 'lucide-react';
import {
  getCountryName,
  getLocalFlagUrl,
  searchCountries,
  type CatalogCountry,
} from '@/lib/countries/catalog';
import { cn } from '@/lib/utils';

function CountryChip({
  code,
  name,
  onRemove,
}: {
  code: string;
  name: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-ash-divider bg-white py-1.5 pl-2 pr-2 text-sm text-portrait-ink shadow-[0_1px_2px_rgba(8,48,76,0.04)]">
      <FlagLogo
        countryCode={code}
        flagUrl={getLocalFlagUrl(code)}
        alt={`${name} flag`}
        size="sm"
        shape="circle"
      />
      <span className="font-medium leading-none">{name}</span>
      <span className="text-xs uppercase text-slate-helper">{code}</span>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-helper transition-colors hover:bg-red-50 hover:text-red-600"
        aria-label={`Remove ${name}`}
      >
        <X className="h-3.5 w-3.5 shrink-0" />
      </button>
    </span>
  );
}

interface BlogCountriesPickerProps {
  value: string[];
  onChange: (codes: string[]) => void;
  error?: string;
}

export function BlogCountriesPicker({
  value,
  onChange,
  error,
}: BlogCountriesPickerProps) {
  const listboxId = useId();
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogCountry[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const codes = value.map((code) => code.trim().toUpperCase()).filter(Boolean);
  const codesKey = codes.join(',');

  useEffect(() => {
    if (!isAdding) return;
    const exclude = codesKey ? codesKey.split(',') : [];
    setResults(searchCountries(query, { excludeCodes: exclude, limit: 10 }));
    setActiveIndex(0);
  }, [query, codesKey, isAdding]);

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
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const cancelAdding = () => {
    setIsAdding(false);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const handleSelect = (country: CatalogCountry) => {
    const code = country.code.toUpperCase();
    if (codes.includes(code)) return;
    onChange([...codes, code]);
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  };

  const handleRemove = (code: string) => {
    onChange(codes.filter((c) => c !== code.toUpperCase()));
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
      if (pick) handleSelect(pick);
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
      className="relative rounded-3xl bg-sky-wash/30 p-6"
    >
      <h4 className="mb-1 text-sm font-medium text-portrait-ink">
        Add countries
      </h4>
      <p className="mb-4 text-sm text-slate-helper">
        Search by name or ISO code, then select to attach. Saved with the post.
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
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search countries (e.g. Thailand, VN, Dubai)…"
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
                return (
                  <li
                    key={country.code}
                    role="option"
                    aria-selected={index === activeIndex}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => handleSelect(country)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
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
                        {code}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={cancelAdding} variant="ghost" size="md">
          Done
        </Button>
      </div>
    </div>
  ) : null;

  if (codes.length === 0 && !isAdding) {
    return (
      <div className="space-y-3">
        <EmptyState
          icon={<Globe className="h-12 w-12" />}
          title="No countries attached"
          description="Attach countries related to this post. They appear as related guides on those countries’ visa listing pages."
          action={{
            label: 'Add Country',
            onClick: startAdding,
          }}
        />
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-helper">
          {codes.length} {codes.length === 1 ? 'country' : 'countries'}{' '}
          attached — saved when you save the post
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

      {searchPanel}

      {codes.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-helper">
            Attached countries
          </p>
          <div className="flex flex-wrap gap-2">
            {codes.map((code) => (
              <CountryChip
                key={code}
                code={code}
                name={getCountryName(code)}
                onRemove={() => handleRemove(code)}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-helper">
          No countries yet — search above to add the first one.
        </p>
      )}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
