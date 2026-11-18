'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Pagination } from '@/components/admin/Pagination';

interface UserApplicationsPaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
}

/**
 * Applicant pagination — keeps the current list path (visa/passport).
 */
export function UserApplicationsPagination({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
}: UserApplicationsPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pushWith = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      itemsPerPage={itemsPerPage}
      totalItems={totalItems}
      onPageChange={(page) =>
        pushWith((params) => {
          params.set('page', String(page));
        })
      }
      onItemsPerPageChange={(limit) =>
        pushWith((params) => {
          params.set('limit', String(limit));
          params.set('page', '1');
        })
      }
    />
  );
}
