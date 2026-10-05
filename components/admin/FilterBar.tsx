'use client';

import { useState, type KeyboardEvent } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Button,
  Input,
  NestedMultiSelect,
  Select,
  type NestedMultiSelectItem,
  type NestedMultiSelectValue,
} from '@/components/ui';

function selectionFromParams(
  searchParams: { get: (key: string) => string | null },
  items: NestedMultiSelectItem[]
): NestedMultiSelectValue {
  const countries = [
    ...(searchParams.get('countries') || '').split(','),
    ...(searchParams.get('country') ? [searchParams.get('country') as string] : []),
  ]
    .map((code) => code.trim().toUpperCase())
    .filter((code) => code.length === 2);
  const listings = (searchParams.get('listings') || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  const parentSet = new Set(countries);
  const childSet = new Set(listings);
  const parents: string[] = [];
  const children: string[] = [];

  for (const item of items ?? []) {
    const ids = (item.children ?? []).map((child) => child.id);
    const selectedKids = ids.filter((id) => childSet.has(id));
    if (parentSet.has(item.id) || (ids.length > 0 && selectedKids.length === ids.length)) {
      if (parentSet.has(item.id) || selectedKids.length > 0) parents.push(item.id);
    } else {
      children.push(...selectedKids);
    }
    ids.forEach((id) => childSet.delete(id));
    parentSet.delete(item.id);
  }

  parents.push(...parentSet);
  children.push(...childSet);
  return { parents, children };
}

/**
 * Filter Bar — Phase 3 inbox filters (URL query params as source of truth).
 * Country options are loaded on the server and passed in.
 */
export function FilterBar({ countryItems }: { countryItems: NestedMultiSelectItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('q') || searchParams.get('search') || '');
  const [phone, setPhone] = useState(searchParams.get('phone') || '');
  const [destination, setDestination] = useState(() =>
    selectionFromParams(searchParams, countryItems)
  );
  const [passenger, setPassenger] = useState(searchParams.get('passenger') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('to') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [type, setType] = useState(searchParams.get('type') || 'all');
  const [expanded, setExpanded] = useState(() => {
    const initialStatus = searchParams.get('status') || 'all';
    const initialType = searchParams.get('type') || 'all';
    return Boolean(
      searchParams.get('phone') ||
        searchParams.get('passenger') ||
        searchParams.get('from') ||
        searchParams.get('to') ||
        (initialStatus && initialStatus !== 'all') ||
        (initialType && initialType !== 'all')
    );
  });

  const applyFilters = () => {
    const params = new URLSearchParams();

    if (search.trim()) params.set('q', search.trim());
    if (phone.trim()) params.set('phone', phone.trim());
    if (destination.parents.length) params.set('countries', destination.parents.join(','));
    if (destination.children.length) params.set('listings', destination.children.join(','));
    if (passenger.trim()) params.set('passenger', passenger.trim());
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    if (status && status !== 'all') params.set('status', status);
    if (type && type !== 'all') params.set('type', type);
    params.set('page', '1');

    router.push(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearch('');
    setPhone('');
    setDestination({ parents: [], children: [] });
    setPassenger('');
    setDateFrom('');
    setDateTo('');
    setStatus('all');
    setType('all');
    router.push(pathname);
  };

  const hasActiveFilters =
    search.trim() !== '' ||
    phone.trim() !== '' ||
    destination.parents.length > 0 ||
    destination.children.length > 0 ||
    passenger.trim() !== '' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    status !== 'all' ||
    type !== 'all';

  const onEnterApply = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') applyFilters();
  };

  return (
    <div className="bg-white border border-ash rounded-[24px] p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <Input
            label="Applicant name"
            placeholder="Name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onEnterApply}
          />
        </div>
        <div className="min-w-0 w-full md:w-64 md:shrink-0">
          <NestedMultiSelect
            label="Country"
            placeholder="All countries"
            items={countryItems}
            value={destination}
            onChange={setDestination}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="inline-flex items-center"
            aria-expanded={expanded}
            aria-controls="application-extra-filters"
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? 'Less' : 'More'}
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className={`ml-1 inline-block h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 7.5 10 12.5 15 7.5" />
            </svg>
          </Button>
          <Button type="button" variant="primary" onClick={applyFilters}>
            Apply filters
          </Button>
          {hasActiveFilters && (
            <Button type="button" variant="ghost" onClick={clearFilters}>
              Reset filters
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div
          id="application-extra-filters"
          className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          <Input
            label="Mobile"
            placeholder="10-digit mobile"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={onEnterApply}
          />
          <Input
            label="Passenger name"
            placeholder="Passenger…"
            value={passenger}
            onChange={(e) => setPassenger(e.target.value)}
            onKeyDown={onEnterApply}
          />
          <Input
            label="From date (IST)"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            label="To date (IST)"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <Select
            label="Status"
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'submitted', label: 'Submitted' },
              { value: 'under_review', label: 'Under Review' },
              { value: 'approved', label: 'Approved' },
              { value: 'partially_approved', label: 'Partially approved' },
              { value: 'rejected', label: 'Rejected' },
            ]}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
          <Select
            label="Type"
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'visa', label: 'Visa' },
              { value: 'passport', label: 'Passport' },
            ]}
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
        </div>
      )}

    </div>
  );
}
