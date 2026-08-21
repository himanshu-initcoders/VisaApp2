import { Card } from '@/components/ui';

/**
 * Loading State for Users Page
 *
 * Skeleton screen matching the layout of the users management page
 */

export default function UsersLoading() {
  return (
    <div className="space-y-6">
      {/* Page Header Skeleton */}
      <div>
        <div className="h-12 bg-mist rounded-lg w-80 animate-pulse" />
        <div className="h-6 bg-mist rounded-lg w-60 mt-2 animate-pulse" />
      </div>

      {/* Filter Bar Skeleton */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-end gap-4">
          <div className="flex-1 w-full">
            <div className="h-4 bg-mist rounded w-16 mb-2 animate-pulse" />
            <div className="h-12 bg-mist rounded-[16px] animate-pulse" />
          </div>
          <div className="w-full lg:w-48">
            <div className="h-4 bg-mist rounded w-12 mb-2 animate-pulse" />
            <div className="h-12 bg-mist rounded-[16px] animate-pulse" />
          </div>
          <div className="h-12 bg-mist rounded-[28px] w-32 animate-pulse" />
        </div>
      </Card>

      {/* Results Summary Skeleton */}
      <div className="h-5 bg-mist rounded w-48 animate-pulse" />

      {/* Table Skeleton */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ash">
                {Array.from({ length: 5 }).map((_, i) => (
                  <th key={i} className="px-4 py-3">
                    <div className="h-3 bg-mist rounded w-24 animate-pulse" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-ash">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-mist rounded w-full animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
