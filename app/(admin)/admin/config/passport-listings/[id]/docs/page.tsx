import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import { getPassportListingWithAllRelations } from '@/lib/db/queries/passport-config';
import { listDocumentTypes } from '@/lib/db/queries/config';
import { PassportComponentsManager } from '@/components/admin/config/PassportComponentsManager';
import { ChevronLeft } from 'lucide-react';

export default async function PassportDocsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['admin']);
  const { id } = await params;
  const listing = await getPassportListingWithAllRelations(id);
  if (!listing) notFound();
  const catalogRows = await listDocumentTypes();
  const catalog = catalogRows.map((row) => ({
    value: row.value,
    label: row.label,
  }));

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
          Documents
        </h1>
        <p className="mb-8 text-slate-helper">
          Required uploads for {listing.name}
        </p>
        <PassportComponentsManager
          listingId={id}
          initialComponents={listing.componentsRequired.map((c) => ({
            id: c.id,
            passportListingId: c.passportListingId,
            key: c.key,
            documentType: c.documentType,
            label: c.label,
            sortOrder: c.sortOrder,
          }))}
          catalog={catalog}
        />
      </div>
    </div>
  );
}
