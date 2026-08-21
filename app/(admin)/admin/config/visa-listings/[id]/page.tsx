import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import { getProcessWithAllRelations } from '@/lib/db/queries/config';
import { ProcessHub } from '@/components/admin/config/ProcessHub';
import { ProcessTypeBadge } from '@/components/admin/config/ProcessTypeBadge';
import { ChevronLeft } from 'lucide-react';

/**
 * Visa Listing Hub Page
 *
 * Central hub for managing all aspects of a visa listing.
 * Displays:
 * - Listing overview (name, type, country)
 * - Management cards for different sections
 * - Multi-country support info (if applicable)
 */
export default async function ProcessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Require admin role
  await requireRole(['admin']);

  // Await params (Next.js 16 requirement)
  const { id } = await params;

  // Fetch process with all relations
  const process = await getProcessWithAllRelations(id);

  if (!process) {
    notFound();
  }

  const firstPrice = process.prices?.[0];
  const firstTotal = firstPrice
    ? parseFloat(firstPrice.governmentFeeAmount || '0') +
      parseFloat(firstPrice.serviceFeeAmount || '0') +
      parseFloat(firstPrice.governmentGstFeeAmount || '0')
    : 0;

  const stats = {
    tiersCount: process.prices?.length || 0,
    questionsCount: process.additionalQuestions?.length || 0,
    documentsCount: process.componentsRequired?.length || 0,
    faqsCount: process.faqs?.length || 0,
  };

  // Get flag emoji
  const getFlag = (iso2Code: string) => {
    const codePoints = iso2Code
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  const multiCountryCount = process.multiTripCountries?.length || 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          href="/admin/config/visa-listings"
          className="inline-flex items-center gap-2 text-sm text-slate-helper hover:text-portrait-ink transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Visa Listings
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-1">
              <h1
                className="text-[44px] font-medium leading-tight tracking-tight text-portrait-ink mb-2"
                style={{ fontFamily: 'Basier Circle', letterSpacing: '-1.15px' }}
              >
                {process.processName}
              </h1>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-base text-slate-helper">
                  {process.country.name}
                </span>
                <span className="text-slate-helper">•</span>
                <ProcessTypeBadge type={process.processType} />
                <span className="text-slate-helper">•</span>
                <span className="text-sm text-slate-helper capitalize">
                  {process.purpose.replace('_', ' ')}
                </span>
                <span className="text-slate-helper">•</span>
                <span className="text-sm text-slate-helper capitalize">
                  {process.country.iso2Code}
                </span>
              </div>
            </div>
          </div>

          {/* Multi-Country Info */}
          {multiCountryCount > 0 && (
            <div className="bg-mint-wash border border-portrait-ink/10 rounded-2xl p-4 inline-flex items-center gap-3">
              <span className="text-sm font-medium text-portrait-ink">
                ✈️ Also valid for {multiCountryCount} additional {multiCountryCount === 1 ? 'country' : 'countries'}
              </span>
              <span className="text-sm text-slate-helper">
                (1 visa for {multiCountryCount + 1} countries!)
              </span>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-ash-divider rounded-2xl p-4">
            <p className="text-xs text-slate-helper mb-1">From (first package)</p>
            <p className="text-xl font-medium text-portrait-ink">
              {firstTotal === 0 ? 'Free' : `₹${firstTotal.toLocaleString('en-IN')}`}
            </p>
          </div>
          <div className="bg-white border border-ash-divider rounded-2xl p-4">
            <p className="text-xs text-slate-helper mb-1">Standard ETA</p>
            <p className="text-xl font-medium text-portrait-ink">
              {process.standardEtaDuration && process.standardEtaUnit
                ? `${process.standardEtaDuration} ${process.standardEtaUnit}`
                : '—'}
            </p>
          </div>
          <div className="bg-white border border-ash-divider rounded-2xl p-4">
            <p className="text-xs text-slate-helper mb-1">Entry Validity</p>
            <p className="text-xl font-medium text-portrait-ink">
              {firstPrice?.entryValidityAmount && firstPrice?.entryValidityUnit
                ? `${firstPrice.entryValidityAmount} ${firstPrice.entryValidityUnit}`
                : '—'}
            </p>
          </div>
          <div className="bg-white border border-ash-divider rounded-2xl p-4">
            <p className="text-xs text-slate-helper mb-1">Stay Duration</p>
            <p className="text-xl font-medium text-portrait-ink">
              {firstPrice?.entryLengthStayAmount && firstPrice?.entryLengthStayUnit
                ? `${firstPrice.entryLengthStayAmount} ${firstPrice.entryLengthStayUnit}`
                : '—'}
            </p>
          </div>
        </div>

        {/* Management Hub - 6 Cards */}
        <div className="mb-6">
          <h2
            className="text-[31px] font-medium text-portrait-ink mb-6"
            style={{ fontFamily: 'Basier Circle', letterSpacing: '-0.4px' }}
          >
            Manage Visa Listing
          </h2>
          <ProcessHub processId={id} stats={stats} />
        </div>
      </div>
    </div>
  );
}
