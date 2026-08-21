import { Card } from '@/components/ui';

/**
 * Loading State for Passport Application Detail Page
 *
 * Skeleton screen matching the two-column layout
 */

export default function PassportApplicationLoading() {
  return (
    <div className="space-y-6">
      {/* Back button skeleton */}
      <div className="h-5 bg-mist rounded w-40 animate-pulse" />

      {/* Page Header Skeleton */}
      <div>
        <div className="h-12 bg-mist rounded-lg w-96 animate-pulse" />
        <div className="h-6 bg-mist rounded-lg w-48 mt-2 animate-pulse" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Application Info Card Skeleton */}
          <Card>
            <div className="p-6 space-y-4">
              <div className="h-6 bg-mist rounded w-48 animate-pulse" />
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i}>
                    <div className="h-3 bg-mist rounded w-20 mb-2 animate-pulse" />
                    <div className="h-5 bg-mist rounded w-full animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Personal Info Card Skeleton */}
          <Card>
            <div className="p-6 space-y-4">
              <div className="h-6 bg-mist rounded w-48 animate-pulse" />
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i}>
                    <div className="h-3 bg-mist rounded w-20 mb-2 animate-pulse" />
                    <div className="h-5 bg-mist rounded w-full animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Address Info Card Skeleton */}
          <Card>
            <div className="p-6 space-y-4">
              <div className="h-6 bg-mist rounded w-48 animate-pulse" />
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i}>
                    <div className="h-3 bg-mist rounded w-32 mb-2 animate-pulse" />
                    <div className="h-5 bg-mist rounded w-full animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Service Details Card Skeleton */}
          <Card>
            <div className="p-6 space-y-4">
              <div className="h-6 bg-mist rounded w-32 animate-pulse" />
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i}>
                    <div className="h-3 bg-mist rounded w-20 mb-2 animate-pulse" />
                    <div className="h-5 bg-mist rounded w-full animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Status Management Card Skeleton */}
          <Card>
            <div className="p-6 space-y-4">
              <div className="h-6 bg-mist rounded w-40 animate-pulse" />
              <div className="h-12 bg-mist rounded-[28px] animate-pulse" />
              <div className="h-12 bg-mist rounded-[28px] animate-pulse" />
            </div>
          </Card>

          {/* Timeline Card Skeleton */}
          <Card>
            <div className="p-6 space-y-4">
              <div className="h-6 bg-mist rounded w-32 animate-pulse" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-mist rounded animate-pulse" />
                ))}
              </div>
            </div>
          </Card>

          {/* Documents Card Skeleton */}
          <Card>
            <div className="p-6 space-y-4">
              <div className="h-6 bg-mist rounded w-32 animate-pulse" />
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-32 bg-mist rounded-[24px] animate-pulse" />
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
