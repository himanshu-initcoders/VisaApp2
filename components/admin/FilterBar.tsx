'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui';

/**
 * Filter Bar — Phase 3 inbox filters (URL query params as source of truth).
 */
export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('q') || searchParams.get('search') || '');
  const [phone, setPhone] = useState(searchParams.get('phone') || '');
  const [country, setCountry] = useState(searchParams.get('country') || '');
  const [passenger, setPassenger] = useState(searchParams.get('passenger') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('to') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [type, setType] = useState(searchParams.get('type') || 'all');

  const applyFilters = () => {
    const params = new URLSearchParams();

    if (search.trim()) params.set('q', search.trim());
    if (phone.trim()) params.set('phone', phone.trim());
    if (country.trim()) params.set('country', country.trim().toUpperCase());
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
    setCountry('');
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
    country.trim() !== '' ||
    passenger.trim() !== '' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    status !== 'all' ||
    type !== 'all';

  return (
    <div className="bg-white border border-ash rounded-[24px] p-6 shadow-sm">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Input
          label="Applicant name"
          placeholder="Name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applyFilters();
          }}
        />
        <Input
          label="Mobile"
          placeholder="10-digit mobile"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applyFilters();
          }}
        />
        <Input
          label="Country"
          placeholder="ISO2 e.g. TH"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applyFilters();
          }}
        />
        <Input
          label="Passenger name"
          placeholder="Passenger…"
          value={passenger}
          onChange={(e) => setPassenger(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applyFilters();
          }}
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {hasActiveFilters && (
          <Button type="button" variant="ghost" onClick={clearFilters}>
            Reset filters
          </Button>
        )}
        <Button type="button" variant="primary" onClick={applyFilters}>
          Apply filters
        </Button>
      </div>
    </div>
  );
}
