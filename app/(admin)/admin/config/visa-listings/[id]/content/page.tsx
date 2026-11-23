import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import {
  getProcessWithAllRelations,
  getFaqs,
  getPostCheckoutSteps,
  getMultiTripCountries,
} from '@/lib/db/queries/config';
import { FaqsManager } from '@/components/admin/config/FaqsManager';
import { PostCheckoutStepsManager } from '@/components/admin/config/PostCheckoutStepsManager';
import { MultiCountryManager } from '@/components/admin/config/MultiCountryManager';
import { DisclaimerEditor } from '@/components/admin/config/DisclaimerEditor';
import { Tabs, TabsPanel } from '@/components/ui';
import { ChevronLeft } from 'lucide-react';

const CONTENT_TABS = [
  { id: 'faqs', label: 'FAQs' },
  { id: 'timeline', label: 'Post-Checkout Timeline' },
  { id: 'multi-country', label: 'Multi-Country Support' },
  { id: 'disclaimer', label: 'Disclaimer' },
] as const;

/**
 * Content & Help Page
 *
 * Allows admins to manage content for an entry process:
 * 1. FAQs - Frequently Asked Questions with markdown answers
 * 2. Post-Checkout Steps - Timeline shown after payment
 * 3. Multi-Country Support - Additional countries where visa is valid
 * 4. Disclaimer - Listing-specific legal/disclaimer HTML (TinyMCE)
 */
export default async function ContentPage({
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

  // Fetch content data
  const faqs = await getFaqs(id);
  const steps = await getPostCheckoutSteps(id);
  const multiCountries = await getMultiTripCountries(id);

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
              Content & Help
            </h1>
          </div>
          <p className="text-base text-slate-helper">
            Manage FAQs, timeline steps, multi-country support, and disclaimer for{' '}
            {process.processName}
          </p>
        </div>

        <Tabs
          items={[...CONTENT_TABS]}
          defaultValue="faqs"
          tone="light"
          layoutId={`visa-listing-content-tabs-${id}`}
          ariaLabel="Content and help sections"
        >
          <TabsPanel id="faqs">
            <FaqsManager processId={id} initialFaqs={faqs} />
          </TabsPanel>

          <TabsPanel id="timeline">
            <p className="text-sm text-slate-helper">
              Steps shown to users after they complete payment
            </p>
            <PostCheckoutStepsManager processId={id} initialSteps={steps} />
          </TabsPanel>

          <TabsPanel id="multi-country">
            <p className="text-sm text-slate-helper">
              Additional countries where this visa is valid.
            </p>
            <MultiCountryManager
              processId={id}
              initialCountries={multiCountries}
              primaryCountry={process.country}
            />
          </TabsPanel>

          <TabsPanel id="disclaimer">
            <DisclaimerEditor
              processId={id}
              initialDisclaimer={process.disclaimer}
            />
          </TabsPanel>
        </Tabs>
      </div>
    </div>
  );
}
