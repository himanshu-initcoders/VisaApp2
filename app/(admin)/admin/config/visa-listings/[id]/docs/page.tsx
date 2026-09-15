import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import { getProcessWithAllRelations, getComponentsRequired } from '@/lib/db/queries/config';
import { ComponentsManager } from '@/components/admin/config/ComponentsManager';
import { ChevronLeft } from 'lucide-react';

/**
 * Document Requirements Page
 *
 * Allows admins to manage required documents for an entry process.
 * Features:
 * - Drag-and-drop reordering
 * - Add/edit/delete from a fixed document-type catalog
 * - Storage keys are UUIDs (not shown in the UI)
 */
export default async function DocumentsPage({
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

  // Fetch components ordered by sortOrder
  const components = await getComponentsRequired(id);

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
              Document Requirements
            </h1>
          </div>
          <p className="text-base text-slate-helper">
            Configure required documents for {process.processName}
          </p>
        </div>

        {/* Components Manager */}
        <ComponentsManager processId={id} initialComponents={components} />
      </div>
    </div>
  );
}
