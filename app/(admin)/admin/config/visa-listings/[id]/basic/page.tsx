import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth-utils';
import { getProcessBasicInfo } from '@/lib/db/queries/config';
import { ProcessBasicInfoForm } from '@/components/admin/config/ProcessBasicInfoForm';

/**
 * Basic Info Page
 *
 * Allows admins to manage the core visa listing metadata:
 * - Naming and process classification
 * - ETA, validity, stay duration, and INR fees (government / service / GST)
 * - Operational flags that affect traveler flows
 */
export default async function BasicInfoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(['admin']);

  const { id } = await params;
  const process = await getProcessBasicInfo(id);

  if (!process) {
    notFound();
  }

  const getFlag = (iso2Code: string) => {
    const codePoints = iso2Code
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              Basic Info
            </h1>
          </div>
          <p className="text-base text-slate-helper">
            Manage the core metadata, timing, pricing, and traveler-facing flags for {process.processName}
          </p>
        </div>

        <ProcessBasicInfoForm processId={id} initialData={process} />
      </div>
    </div>
  );
}
