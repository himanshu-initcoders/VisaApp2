'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Pagination } from '@/components/admin/Pagination';

/**
 * Client-side pagination wrapper
 * Handles URL navigation for page changes
 */

interface PaginationClientProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
}

export function PaginationClient({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
}: PaginationClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    router.push(`/admin/applications?${params.toString()}`);
  };

  const handleItemsPerPageChange = (limit: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('limit', limit.toString());
    params.set('page', '1'); // Reset to first page
    router.push(`/admin/applications?${params.toString()}`);
  };

  return (
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      itemsPerPage={itemsPerPage}
      totalItems={totalItems}
      onPageChange={handlePageChange}
      onItemsPerPageChange={handleItemsPerPageChange}
    />
  );
}
