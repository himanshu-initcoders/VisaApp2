import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import { getProcessWithAllRelations, getListingPrices } from '@/lib/db/queries/config';
import { PriceOptionsManager } from '@/components/admin/config/PriceOptionsManager';
import { ChevronLeft } from 'lucide-react';

/**
 * Price options by entry validity + stay duration (three INR fees each).
 */
export default async function TiersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['admin']);

  const { id } = await params;
  const process = await getProcessWithAllRelations(id);

  if (!process) {
    notFound();
  }

  const prices = await getListingPrices(id);

  const getFlag = (iso2Code: string) => {
    const codePoints = iso2Code
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href={`/admin/config/visa-listings/${id}`}
          className="inline-flex items-center gap-2 text-sm text-slate-helper hover:text-portrait-ink transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Visa Listing
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{getFlag(process.country.iso2Code)}</span>
            <h1
              className="text-[44px] font-medium leading-tight tracking-tight text-portrait-ink"
              style={{ fontFamily: 'Basier Circle', letterSpacing: '-1.15px' }}
            >
              Pricing
            </h1>
          </div>
          <p className="text-base text-slate-helper">
            Multiple packages for {process.processName} — each with validity, stay, and fees
          </p>
        </div>

        <PriceOptionsManager processId={id} initialPrices={prices} />
      </div>
    </div>
  );
}
