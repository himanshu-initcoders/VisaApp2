import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MotionReveal } from '@/components/public/MotionReveal';
import { StickySectionNav } from '@/components/public/StickySectionNav';
import { RequirementsGrid } from '@/components/public/RequirementsGrid';
import { ListingHero } from '@/components/public/ListingHero';
import { ListingOverviewSection } from '@/components/public/ListingOverviewSection';
import { ProcessTimeline } from '@/components/public/ProcessTimeline';
import { FaqAccordion } from '@/components/public/FaqAccordion';
import { ExploreMoreRail } from '@/components/public/ExploreMoreRail';
import { MobileStickyBar } from '@/components/public/MobileStickyBar';
import { getPublicProcessPageData } from '@/lib/db/queries/public';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    countryCode: string;
    listingId: string;
  }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { countryCode, listingId } = await params;
  const data = await getPublicProcessPageData(countryCode, listingId);

  if (!data) return {};

  return {
    title: `${data.process.processName} for ${data.country.name}`,
    description: `${data.process.processName} for Indian travelers. See pricing, timeline, and document requirements before you start.`,
  };
}

export default async function PublicProcessPage({ params }: PageProps) {
  const { countryCode, listingId } = await params;
  const data = await getPublicProcessPageData(countryCode, listingId);

  if (!data) {
    notFound();
  }

  const navItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'requirements', label: 'Requirements' },
    { id: 'process', label: 'Process' },
    { id: 'faqs', label: 'FAQs' },
  ];

  return (
    <>
      <Header overlay theme="dark" />
      <main className="min-h-screen bg-[#f8f6f1]">
        <ListingHero
          countryName={data.country.name}
          countryFlag={data.country.flag}
          flagUrl={data.country.images?.flag?.url}
          heroImageUrl={data.country.images?.hero?.url}
          heroImageAlt={data.country.images?.hero?.alt || data.country.name}
          purpose={data.process.purpose}
          entryType={data.process.entryType}
          processName={data.process.processName}
          overview={data.page.overview}
          processingEta={data.process.standardEta}
        />

        <StickySectionNav
          items={navItems}
          className="border-ash-divider/40 bg-[#f8f6f1]/95"
        />

        <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:space-y-20 sm:px-6 sm:py-16 lg:px-8">
          {/* Overview */}
          <ListingOverviewSection
            overview={data.page.overview}
            processingEta={data.process.standardEta}
            fallbackStay={data.process.stayDuration}
            isFree={data.page.isFree}
            countryCode={data.country.iso2Code}
            listingId={data.process.id}
            priceOptions={data.page.pricing.priceOptions}
            headline={data.page.pricing.headline}
            visaKinds={data.page.visaKinds}
          />

          {/* Requirements */}
          <section id="requirements" className="space-y-5 sm:space-y-8">
            <MotionReveal className="max-w-2xl space-y-2 sm:space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-helper sm:text-sm">
                Required to apply
              </p>
              <h2 className="font-basier text-2xl text-portrait-ink sm:text-4xl">
                What documents do you need?
              </h2>
              <p className="text-[15px] leading-7 text-slate-helper sm:text-base">
                Each item gives a quick summary so you know what to prepare
                before uploading.
              </p>
            </MotionReveal>
            <RequirementsGrid items={data.page.requirements} />
          </section>

          {/* Process */}
          <section id="process" className="space-y-5 sm:space-y-8">
            <MotionReveal className="max-w-2xl space-y-2 sm:space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-helper sm:text-sm">
                The process
              </p>
              <h2 className="font-basier text-2xl text-portrait-ink sm:text-4xl">
                Step by step, from start to approval.
              </h2>
              <p className="text-[15px] leading-7 text-slate-helper sm:text-base">
                Follow the simple steps below — we guide you through every one.
              </p>
            </MotionReveal>
            <ProcessTimeline steps={data.page.timeline} />
          </section>

          {/* FAQs */}
          <section id="faqs" className="space-y-5 sm:space-y-8">
            <MotionReveal className="max-w-2xl space-y-2 sm:space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-helper sm:text-sm">
                Frequently asked questions
              </p>
              <h2 className="font-basier text-2xl text-portrait-ink sm:text-4xl">
                Common questions, answered.
              </h2>
            </MotionReveal>
            <FaqAccordion faqs={data.page.faqs} />
            {data.page.relatedQuestions.length > 0 && (
              <div className="rounded-2xl border border-ash-divider bg-white p-5 shadow-card sm:rounded-[28px] sm:p-6">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-helper sm:text-sm">
                  Extra questions in this application
                </p>
                <ul className="mt-3 grid gap-2 sm:mt-4 sm:grid-cols-2 sm:gap-3">
                  {data.page.relatedQuestions.map((question) => (
                    <li
                      key={question.id}
                      className="rounded-xl bg-[#f8fafc] px-4 py-3 text-[15px] text-portrait-ink sm:rounded-[18px] sm:text-sm"
                    >
                      {question.label}
                      {question.required ? ' *' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {data.page.exploreMore.length > 0 && (
            <section id="explore">
              <ExploreMoreRail items={data.page.exploreMore} />
            </section>
          )}
        </div>

        {/* Mobile sticky bottom CTA */}
        <MobileStickyBar
          price={data.process.formattedStartingPrice}
          processName={data.process.processName}
          countryCode={data.country.iso2Code}
          listingId={data.process.id}
        />
      </main>
      <Footer />
    </>
  );
}
