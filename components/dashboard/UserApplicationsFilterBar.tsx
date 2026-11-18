'use client';

import { useState, type KeyboardEvent } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button, Input } from '@/components/ui';

/**
 * Compact reference search — sits in the list toolbar, not a heavy card.
 */
export function UserApplicationsFilterBar({
  scope,
}: {
  scope: 'visa' | 'passport';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [referenceNumber, setReferenceNumber] = useState(
    searchParams.get('ref') || ''
  );

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (referenceNumber.trim()) {
      params.set('ref', referenceNumber.trim());
    } else {
      params.delete('ref');
    }
    params.set('page', '1');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const clearFilters = () => {
    setReferenceNumber('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('ref');
    params.delete('page');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const onEnterApply = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') applyFilters();
  };

  const hasActiveFilters = Boolean(searchParams.get('ref')?.trim());

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
      <div className="min-w-0 w-full sm:max-w-xs">
        <Input
          aria-label="Reference number"
          placeholder={
            scope === 'visa' ? 'Search VI reference…' : 'Search PS reference…'
          }
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
          onKeyDown={onEnterApply}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="primary" size="sm" onClick={applyFilters}>
          Search
        </Button>
        {hasActiveFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}
