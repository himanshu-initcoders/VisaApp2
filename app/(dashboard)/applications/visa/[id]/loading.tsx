import { Card } from '@/components/ui';

export default function UserVisaApplicationLoading() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-40 animate-pulse rounded bg-mist" />

      <div>
        <div className="h-12 w-96 animate-pulse rounded-lg bg-mist" />
        <div className="mt-2 h-6 w-48 animate-pulse rounded-lg bg-mist" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="space-y-4 p-6">
              <div className="h-6 w-48 animate-pulse rounded bg-mist" />
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i}>
                    <div className="mb-2 h-3 w-20 animate-pulse rounded bg-mist" />
                    <div className="h-5 w-full animate-pulse rounded bg-mist" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card>
            <div className="space-y-4 p-6">
              <div className="h-6 w-48 animate-pulse rounded bg-mist" />
              <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i}>
                    <div className="mb-2 h-3 w-20 animate-pulse rounded bg-mist" />
                    <div className="h-5 w-full animate-pulse rounded bg-mist" />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="space-y-4 p-6">
              <div className="h-6 w-32 animate-pulse rounded bg-mist" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded bg-mist" />
                ))}
              </div>
            </div>
          </Card>
          <Card>
            <div className="space-y-4 p-6">
              <div className="h-6 w-32 animate-pulse rounded bg-mist" />
              <div className="h-48 animate-pulse rounded-[24px] bg-mist" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
