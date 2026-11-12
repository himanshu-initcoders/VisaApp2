import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import { getAllPassportListings } from '@/lib/db/queries/passport-config';
import { ConfigEmptyState } from '@/components/admin/config/ConfigEmptyState';
import { passportServiceTypeLabel } from '@/lib/passport/constants';
import { PageHeader } from '@/components/admin/PageHeader';

export default async function PassportListingsPage() {
  await requireRole(['admin']);
  const listings = await getAllPassportListings();

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Passport Listings"
          description="India-only Fresh and Re-issue products — pricing, forms, documents, and FAQs."
        />

        {listings.length === 0 ? (
          <ConfigEmptyState
            title="No passport listings"
            description="Run the passport catalog migration to seed Fresh and Re-issue products."
            actionLabel="Document Types"
            actionHref="/admin/config/document-types"
          />
        ) : (
          <div className="mt-8 space-y-4">
            {listings.map((listing) => {
              const first = listing.prices[0];
              const from = first
                ? parseFloat(first.governmentFeeAmount) +
                  parseFloat(first.serviceFeeAmount) +
                  parseFloat(first.governmentGstFeeAmount)
                : 0;
              return (
                <Link
                  key={listing.id}
                  href={`/admin/config/passport-listings/${listing.id}`}
                  className="flex flex-col gap-2 rounded-3xl border border-ash-divider bg-white p-6 transition hover:shadow-card sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-lg font-medium text-portrait-ink">
                      {listing.name}
                    </p>
                    <p className="text-sm text-slate-helper">
                      {passportServiceTypeLabel(listing.serviceType)} ·{' '}
                      {listing.isActive ? 'Active' : 'Inactive'} ·{' '}
                      {listing.prices.length} price package
                      {listing.prices.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-portrait-ink">
                    From ₹{from.toLocaleString('en-IN')}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
