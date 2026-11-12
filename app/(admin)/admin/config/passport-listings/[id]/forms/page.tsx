import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import {
  getPassportListingWithAllRelations,
  getLatestPassportFormVersion,
} from '@/lib/db/queries/passport-config';
import { listDocumentTypes } from '@/lib/db/queries/config';
import { PassportFormStepsManager } from '@/components/admin/config/PassportFormStepsManager';
import { ChevronLeft } from 'lucide-react';

export default async function PassportFormsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['admin']);
  const { id } = await params;
  const listing = await getPassportListingWithAllRelations(id);
  if (!listing) notFound();

  const [latestVersion, catalogRows] = await Promise.all([
    getLatestPassportFormVersion(id),
    listDocumentTypes(),
  ]);

  const documentCatalog = catalogRows.map((row) => ({
    value: row.value,
    label: row.label,
  }));

  const attachedDocumentTypes = listing.componentsRequired
    .map((item) => item.documentType || item.key)
    .filter((value): value is string => Boolean(value));

  return (
    <div>
      <Link
        href={`/admin/config/passport-listings/${id}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-helper hover:text-portrait-ink"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Passport Listing
      </Link>
      <PassportFormStepsManager
        listingId={id}
        productName={listing.name}
        latestVersion={latestVersion?.version ?? null}
        latestPublishedAt={
          latestVersion?.publishedAt
            ? latestVersion.publishedAt.toISOString()
            : null
        }
        catalog={documentCatalog}
        attachedDocumentTypes={attachedDocumentTypes}
        initialSteps={listing.formSteps.map((step) => ({
          id: step.id,
          title: step.title,
          description: step.description,
          sortOrder: step.sortOrder,
          questions: (step.questions ?? []).map((q) => ({
            id: q.id,
            key: q.key,
            stepId: q.stepId,
            label: q.label,
            description: q.description,
            questionType: q.questionType,
            required: q.required,
            options: q.options,
            visibility: q.visibility ?? undefined,
            documentConditions: q.documentConditions ?? undefined,
            requiredDoc: q.requiredDoc,
            extraInfo: q.extraInfo,
            sourceUrl: q.sourceUrl,
            sortOrder: q.sortOrder,
          })),
        }))}
      />
    </div>
  );
}
