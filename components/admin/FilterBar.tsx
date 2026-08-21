'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui';

/**
 * Filter Bar Component
 *
 * Horizontal filter bar for applications list:
 * - Search input (by name/email)
 * - Status dropdown
 * - Type dropdown (Visa/Passport)
 * - Clear Filters button
 * - Updates URL search params on change
 */

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize filter state from URL params
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [type, setType] = useState(searchParams.get('type') || 'all');

  // Update URL when filters change
  const applyFilters = () => {
    const params = new URLSearchParams(searchParams);

    // Add/remove search param
    if (search.trim()) {
      params.set('search', search.trim());
    } else {
      params.delete('search');
    }

    // Add/remove status param
    if (status && status !== 'all') {
      params.set('status', status);
    } else {
      params.delete('status');
    }

    // Add/remove type param
    if (type && type !== 'all') {
      params.set('type', type);
    } else {
      params.delete('type');
    }

    // Reset to page 1 when filters change
    params.set('page', '1');

    router.push(`${pathname}?${params.toString()}`);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setType('all');
    router.push(pathname);
  };

  // Check if any filters are active
  const hasActiveFilters =
    search.trim() !== '' || status !== 'all' || type !== 'all';

  return (
    <div className="bg-white border border-ash rounded-[24px] p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row items-start lg:items-end gap-4">
        {/* Search input */}
        <div className="flex-1 w-full lg:w-auto">
          <Input
            label="Search"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                applyFilters();
              }
            }}
          />
        </div>

        {/* Status filter */}
        <div className="w-full lg:w-48">
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
        </div>

        {/* Type filter */}
        <div className="w-full lg:w-48">
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

        {/* Action buttons */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              onClick={clearFilters}
              className="flex-1 lg:flex-initial"
            >
              Clear
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            onClick={applyFilters}
            className="flex-1 lg:flex-initial"
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
}
