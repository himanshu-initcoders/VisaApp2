'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Card, Input, Select, Button } from '@/components/ui';

/**
 * Users Filter Bar Component
 *
 * Client-side filter controls for users list
 */

export function UsersFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [role, setRole] = useState(searchParams.get('role') || 'all');

  const applyFilters = () => {
    const params = new URLSearchParams();

    if (search.trim()) {
      params.set('search', search.trim());
    }
    if (role && role !== 'all') {
      params.set('role', role);
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearch('');
    setRole('all');
    router.push(pathname);
  };

  const hasActiveFilters = search.trim() !== '' || role !== 'all';

  return (
    <Card className="p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row items-start lg:items-end gap-4">
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

        <div className="w-full lg:w-48">
          <Select
            label="Role"
            options={[
              { value: 'all', label: 'All Roles' },
              { value: 'user', label: 'User' },
              { value: 'reviewer', label: 'Reviewer' },
              { value: 'admin', label: 'Admin' },
            ]}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} className="flex-1 lg:flex-initial">
              Clear
            </Button>
          )}
          <Button variant="primary" onClick={applyFilters} className="flex-1 lg:flex-initial">
            Apply Filters
          </Button>
        </div>
      </div>
    </Card>
  );
}
