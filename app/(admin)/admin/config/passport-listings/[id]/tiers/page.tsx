import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import {
  getPassportListingById,
  getPassportPrices,
} from '@/lib/db/queries/passport-config';
import { PassportPriceOptionsManager } from '@/components/admin/config/PassportPriceOptionsManager';
import { ChevronLeft } from 'lucide-react';

export default async function PassportTiersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['admin']);
  const { id } = await params;
  const listing = await getPassportListingById(id);
  if (!listing) notFound();
  const prices = await getPassportPrices(id);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={`/admin/config/passport-listings/${id}`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-helper hover:text-portrait-ink"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Passport Listing
        </Link>
        <h1
          className="mb-2 text-[44px] font-medium text-portrait-ink"
          style={{ fontFamily: 'Basier Circle', letterSpacing: '-1.15px' }}
        >
          Pricing
        </h1>
        <p className="mb-8 text-slate-helper">
          Packages for {listing.name}
        </p>
        <PassportPriceOptionsManager
          listingId={id}
          initialPrices={prices.map((p) => ({
            id: p.id,
            passportListingId: p.passportListingId,
            scheme: p.scheme,
            bookletPages: p.bookletPages,
            governmentFeeAmount: p.governmentFeeAmount,
            serviceFeeAmount: p.serviceFeeAmount,
            governmentGstFeeAmount: p.governmentGstFeeAmount,
            sortOrder: p.sortOrder,
          }))}
        />
      </div>
    </div>
  );
}
