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
import { ChevronLeft } from 'lucide-react';

/**
 * Content & Help Page
 *
 * Allows admins to manage content for an entry process:
 * 1. FAQs - Frequently Asked Questions with markdown answers
 * 2. Post-Checkout Steps - Timeline shown after payment
 * 3. Multi-Country Support - Additional countries where visa is valid
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
            Manage FAQs, timeline steps, and multi-country support for {process.processName}
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-12">
          {/* FAQs Section */}
          <section>
            <h2
              className="text-[31px] font-medium text-portrait-ink mb-6"
              style={{ fontFamily: 'Basier Circle', letterSpacing: '-0.4px' }}
            >
              Frequently Asked Questions
            </h2>
            <FaqsManager processId={id} initialFaqs={faqs} />
          </section>

          {/* Post-Checkout Steps Section */}
          <section>
            <h2
              className="text-[31px] font-medium text-portrait-ink mb-6"
              style={{ fontFamily: 'Basier Circle', letterSpacing: '-0.4px' }}
            >
              Post-Checkout Timeline
            </h2>
            <p className="text-sm text-slate-helper mb-6">
              Steps shown to users after they complete payment
            </p>
            <PostCheckoutStepsManager processId={id} initialSteps={steps} />
          </section>

          {/* Multi-Country Support Section */}
          <section>
            <h2
              className="text-[31px] font-medium text-portrait-ink mb-6"
              style={{ fontFamily: 'Basier Circle', letterSpacing: '-0.4px' }}
            >
              Multi-Country Visa Support
            </h2>
            <p className="text-sm text-slate-helper mb-6">
              Additional countries where this visa is valid (e.g., Japan visa valid for 6 more
              countries)
            </p>
            <MultiCountryManager
              processId={id}
              initialCountries={multiCountries}
              primaryCountry={process.country}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
