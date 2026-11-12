import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import { getPassportListingWithAllRelations } from '@/lib/db/queries/passport-config';
import { PassportHub } from '@/components/admin/config/PassportHub';
import { passportServiceTypeLabel } from '@/lib/passport/constants';
import { ChevronLeft } from 'lucide-react';

export default async function PassportListingHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['admin']);
  const { id } = await params;
  const listing = await getPassportListingWithAllRelations(id);
  if (!listing) notFound();

  const firstPrice = listing.prices?.[0];
  const firstTotal = firstPrice
    ? parseFloat(firstPrice.governmentFeeAmount || '0') +
      parseFloat(firstPrice.serviceFeeAmount || '0') +
      parseFloat(firstPrice.governmentGstFeeAmount || '0')
    : 0;

  const stats = {
    tiersCount: listing.prices?.length || 0,
    questionsCount: listing.additionalQuestions?.length || 0,
    documentsCount: listing.componentsRequired?.length || 0,
    faqsCount: listing.faqs?.length || 0,
    stepsCount: listing.formSteps?.length || 0,
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/admin/config/passport-listings"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-helper transition-colors hover:text-portrait-ink"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Passport Listings
        </Link>

        <div className="mb-8">
          <h1
            className="mb-2 text-[44px] font-medium leading-tight tracking-tight text-portrait-ink"
            style={{ fontFamily: 'Basier Circle', letterSpacing: '-1.15px' }}
          >
            {listing.name}
          </h1>
          <p className="text-base text-slate-helper">
            India · {passportServiceTypeLabel(listing.serviceType)} ·{' '}
            {listing.isActive ? 'Active' : 'Inactive'}
          </p>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-ash-divider bg-white p-4">
            <p className="mb-1 text-xs text-slate-helper">From (first package)</p>
            <p className="text-xl font-medium text-portrait-ink">
              ₹{firstTotal.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="rounded-2xl border border-ash-divider bg-white p-4">
            <p className="mb-1 text-xs text-slate-helper">Standard ETA</p>
            <p className="text-xl font-medium text-portrait-ink">
              {listing.standardEtaDuration && listing.standardEtaUnit
                ? `${listing.standardEtaDuration} ${listing.standardEtaUnit}`
                : '—'}
            </p>
          </div>
          <div className="rounded-2xl border border-ash-divider bg-white p-4">
            <p className="mb-1 text-xs text-slate-helper">Form steps</p>
            <p className="text-xl font-medium text-portrait-ink">
              {stats.stepsCount}
            </p>
          </div>
          <div className="rounded-2xl border border-ash-divider bg-white p-4">
            <p className="mb-1 text-xs text-slate-helper">Documents</p>
            <p className="text-xl font-medium text-portrait-ink">
              {stats.documentsCount}
            </p>
          </div>
        </div>

        <h2
          className="mb-6 text-[31px] font-medium text-portrait-ink"
          style={{ fontFamily: 'Basier Circle', letterSpacing: '-0.4px' }}
        >
          Manage Passport Listing
        </h2>
        <PassportHub listingId={id} stats={stats} />
      </div>
    </div>
  );
}
