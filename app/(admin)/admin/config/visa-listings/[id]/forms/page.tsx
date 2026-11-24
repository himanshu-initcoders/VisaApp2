import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import {
  getProcessWithAllRelations,
  getComponentsRequired,
  getVisaFormStepsWithQuestions,
  listDocumentTypes,
} from '@/lib/db/queries/config';
import { getLatestPublishedFormVersion } from '@/lib/db/queries/formVersions';
import { VisaFormStepsManager } from '@/components/admin/config/VisaFormStepsManager';
import { PASSPORT_DOCUMENT_TYPES } from '@/lib/document-types';
import { isDigitalArrivalCard } from '@/lib/visa/processTypes';
import { seedDefaultVisaFormSteps } from '@/lib/db/seedVisaFormSteps';
import { ChevronLeft } from 'lucide-react';
import type { VisaFormStepKind } from '@/lib/apply/visaSystemFields';

/**
 * Form Builder Page
 *
 * Passport-style steps: OCR (Personal details), Trip details, and custom steps.
 * Admins can rename steps, edit/remove questions, and publish form versions.
 */
export default async function FormsPage({
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

  let formSteps = await getVisaFormStepsWithQuestions(id);
  if (formSteps.length === 0) {
    await seedDefaultVisaFormSteps(id);
    formSteps = await getVisaFormStepsWithQuestions(id);
  }

  const [components, catalogRows] = await Promise.all([
    getComponentsRequired(id),
    listDocumentTypes(),
  ]);
  const latestVersion = await getLatestPublishedFormVersion(id);

  const documentCatalog = catalogRows
    .filter((row) => !PASSPORT_DOCUMENT_TYPES.has(row.value))
    .map((row) => ({ value: row.value, label: row.label }));

  const attachedDocumentTypes = components
    .map((item) => item.documentType || item.key)
    .filter((value): value is string => Boolean(value));

  const getFlag = (iso2Code: string) => {
    const codePoints = iso2Code
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  const isArrivalCard = isDigitalArrivalCard(process.processType);

  const initialSteps = formSteps.map((step) => ({
    id: step.id,
    title: step.title,
    description: step.description,
    kind: step.kind as VisaFormStepKind,
    sortOrder: step.sortOrder,
    questions: (step.questions ?? []).map((q) => ({
      id: q.id,
      key: q.key,
      stepId: q.stepId ?? step.id,
      systemKey: q.systemKey,
      label: q.label,
      description: q.description,
      questionType: q.questionType,
      required: q.required,
      options: q.options,
      visibility: q.visibility ?? undefined,
      documentConditions: q.documentConditions ?? undefined,
      sortOrder: q.sortOrder,
      requiredDoc: q.requiredDoc,
      extraInfo: q.extraInfo,
      sourceUrl: q.sourceUrl,
      catalogQuestionId: q.catalogQuestionId,
    })),
  }));

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href={`/admin/config/visa-listings/${id}`}
          className="inline-flex items-center gap-2 text-sm text-slate-helper hover:text-portrait-ink transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to {isArrivalCard ? 'Arrival Card Listing' : 'Visa Listing'}
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <span className="text-2xl">{getFlag(process.country.iso2Code)}</span>
          <p className="text-base text-slate-helper">{process.processName}</p>
        </div>

        <VisaFormStepsManager
          listingId={id}
          productName={process.processName}
          initialSteps={initialSteps}
          catalog={documentCatalog}
          attachedDocumentTypes={attachedDocumentTypes}
          latestVersion={latestVersion?.version ?? null}
          latestPublishedAt={
            latestVersion?.publishedAt
              ? latestVersion.publishedAt.toISOString()
              : null
          }
        />
      </div>
    </div>
  );
}
