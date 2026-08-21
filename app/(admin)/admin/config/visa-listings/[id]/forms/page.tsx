import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import { getProcessWithAllRelations, getAdditionalQuestions } from '@/lib/db/queries/config';
import { QuestionsManager } from '@/components/admin/config/QuestionsManager';
import { ChevronLeft } from 'lucide-react';

/**
 * Form Builder Page
 *
 * Allows admins to manage country-specific dynamic questions for an entry process.
 * Features:
 * - Drag-and-drop reordering
 * - Add/edit/delete questions
 * - Support for 7 question types (text, date, dropdown, select, file, flight, boolean)
 * - Configure family-enabled and B2B-only questions
 * - Manage dropdown options
 */
export default async function FormsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Require admin role
  await requireRole(['admin']);

  // Await params (Next.js 16 requirement)
  const { id } = await params;

  // Fetch process details
  const process = await getProcessWithAllRelations(id);

  if (!process) {
    notFound();
  }

  // Fetch questions ordered by sortOrder
  const questions = await getAdditionalQuestions(id);

  // Get flag emoji
  const getFlag = (iso2Code: string) => {
    const codePoints = iso2Code
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          href={`/admin/config/visa-listings/${id}`}
          className="inline-flex items-center gap-2 text-sm text-slate-helper hover:text-portrait-ink transition-colors mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Visa Listing
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{getFlag(process.country.iso2Code)}</span>
            <h1
              className="text-[44px] font-medium leading-tight tracking-tight text-portrait-ink"
              style={{ fontFamily: 'Basier Circle', letterSpacing: '-1.15px' }}
            >
              Form Builder
            </h1>
          </div>
          <p className="text-base text-slate-helper">
            Configure dynamic questions for {process.processName}
          </p>
        </div>

        {/* Questions Manager */}
        <QuestionsManager processId={id} initialQuestions={questions} />
      </div>
    </div>
  );
}
