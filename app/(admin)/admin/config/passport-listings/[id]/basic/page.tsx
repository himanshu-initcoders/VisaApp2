import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import { getPassportListingById } from '@/lib/db/queries/passport-config';
import { PassportBasicInfoForm } from '@/components/admin/config/PassportBasicInfoForm';
import { ChevronLeft } from 'lucide-react';

export default async function PassportBasicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['admin']);
  const { id } = await params;
  const listing = await getPassportListingById(id);
  if (!listing) notFound();

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
          Basic Info
        </h1>
        <p className="mb-8 text-slate-helper">{listing.name}</p>
        <PassportBasicInfoForm
          listingId={id}
          serviceType={listing.serviceType}
          slug={listing.slug}
          defaultValues={{
            name: listing.name,
            description: listing.description || '',
            standardEtaDuration: listing.standardEtaDuration,
            standardEtaUnit: listing.standardEtaUnit,
            isActive: listing.isActive,
          }}
        />
      </div>
    </div>
  );
}
