import { notFound } from 'next/navigation';
import Image from 'next/image';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MotionReveal, CountUp } from '@/components/public/MotionReveal';
import { StickySectionNav } from '@/components/public/StickySectionNav';
import { RequirementsGrid } from '@/components/public/RequirementsGrid';
import { PricingPanel } from '@/components/public/PricingPanel';
import { ProcessTimeline } from '@/components/public/ProcessTimeline';
import { FaqAccordion } from '@/components/public/FaqAccordion';
import { ExploreMoreRail } from '@/components/public/ExploreMoreRail';
import { MobileStickyBar } from '@/components/public/MobileStickyBar';
import { StartApplicationCTA } from '@/components/apply/StartApplicationCTA';
import { getPublicProcessPageData } from '@/lib/db/queries/public';

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
      <Header />
      <main className="min-h-screen bg-[#f8f6f1] pt-20 sm:pt-24">
        {/* Hero */}
        <section className="relative overflow-hidden bg-[#08111f] px-4 py-10 text-white sm:px-6 sm:py-20 lg:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(38,192,255,0.18),transparent_36%),radial-gradient(circle_at_85%_20%,rgba(230,0,194,0.15),transparent_32%)]" />

          <div className="relative mx-auto max-w-7xl">
            {/* Mobile: image first, then content stacked */}
            <div className="sm:hidden">
              <MotionReveal>
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <div className="relative h-48">
                    {data.country.images?.hero?.url ? (
                      <Image
                        src={data.country.images.hero.url}
                        alt={data.country.images.hero.alt || data.country.name}
                        fill
                        className="object-cover"
                        priority
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-sky-wash text-6xl text-portrait-ink">
                        {data.country.flag}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#08111f] via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                      <span className="text-sm text-white/70">{data.country.name}</span>
                      <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-portrait-ink">
                        {data.page.isFree ? 'Free' : data.process.formattedStartingPrice}
                      </span>
                    </div>
                  </div>
                </div>
              </MotionReveal>

              <MotionReveal className="mt-5 space-y-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">
                  {data.page.eyebrow}
                </p>
                <h1 className="font-basier text-[1.75rem] leading-[1.1] text-white">
                  {data.process.processName}
                  <span className="block bg-gradient-to-r from-cyan-300 via-white to-pink-300 bg-clip-text text-transparent">
                    {data.page.accentLabel}
                  </span>
                </h1>
                <p className="text-[15px] leading-7 text-white/74">
                  {data.page.overview}
                </p>

                {/* Horizontal scrollable stats */}
                <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
                  {data.page.stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="shrink-0 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 backdrop-blur"
                    >
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/50">
                        {stat.label}
                      </p>
                      <p className="mt-1 text-base font-medium text-white">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 text-xs text-white/60">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    <CountUp value={data.page.weeklyApplications} /> applied this week
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Guided process
                  </span>
                </div>
              </MotionReveal>
            </div>

            {/* Desktop: side-by-side layout */}
            <div className="hidden items-end gap-10 sm:grid lg:grid-cols-[1fr_0.9fr]">
              <MotionReveal className="space-y-7">
                <div className="inline-flex items-center rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs uppercase tracking-[0.24em] text-white/72">
                  {data.page.eyebrow}
                </div>
                <div className="space-y-4">
                  <h1 className="font-basier text-5xl leading-[0.95] text-white sm:text-6xl">
                    {data.process.processName}
                    <span className="block bg-gradient-to-r from-cyan-300 via-white to-pink-300 bg-clip-text text-transparent">
                      {data.page.accentLabel}
                    </span>
                  </h1>
                  <p className="max-w-2xl text-lg leading-8 text-white/74">
                    {data.page.overview}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {data.page.stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-[26px] border border-white/10 bg-white/8 px-5 py-4 backdrop-blur"
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                        {stat.label}
                      </p>
                      <p className="mt-3 text-lg font-medium text-white">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <StartApplicationCTA
                    countryCode={data.country.iso2Code}
                    listingId={data.process.id}
                  />
                  <div className="flex flex-wrap items-center gap-4 text-sm text-white/74">
                    <span className="inline-flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      <CountUp value={data.page.weeklyApplications} /> travelers applied this week
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      Official-feeling guidance before payment
                    </span>
                  </div>
                </div>
              </MotionReveal>

              <MotionReveal delayMs={120}>
                <div className="overflow-hidden rounded-[34px] border border-white/10 bg-white/8 shadow-elevated backdrop-blur-xl">
                  <div className="relative h-[380px]">
                    {data.country.images?.hero?.url ? (
                      <Image
                        src={data.country.images.hero.url}
                        alt={data.country.images.hero.alt || data.country.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-sky-wash text-8xl text-portrait-ink">
                        {data.country.flag}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#08111f]/90 via-[#08111f]/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <p className="text-sm uppercase tracking-[0.18em] text-white/60">
                        {data.country.name}
                      </p>
                      <div className="mt-3 flex items-end justify-between gap-4">
                        <div>
                          <p className="text-3xl font-semibold text-white">
                            {data.process.formattedStartingPrice}
                          </p>
                          <p className="mt-1 text-sm text-white/70">
                            {data.process.standardEta || 'Timeline shared after review'}
                          </p>
                        </div>
                        <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-portrait-ink">
                          {data.page.isFree ? 'No payment' : 'Transparent fees'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </MotionReveal>
            </div>
          </div>
        </section>

        <StickySectionNav items={navItems} />

        <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:space-y-20 sm:px-6 sm:py-16 lg:px-8">
          {/* Overview */}
          <section id="overview" className="space-y-6 sm:space-y-0 lg:grid lg:grid-cols-[1fr_0.95fr] lg:gap-8">
            <MotionReveal className="space-y-3 sm:space-y-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-helper sm:text-sm">
                Product overview
              </p>
              <h2 className="font-basier text-2xl leading-tight text-portrait-ink sm:text-4xl">
                Know what this product is, who it helps, and how fast it moves.
              </h2>
              <p className="max-w-2xl text-[15px] leading-7 text-slate-helper sm:text-base sm:leading-8">
                {data.page.overview}
              </p>
              {/* Stats — horizontal scroll on mobile, grid on desktop */}
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0">
                <div className="shrink-0 rounded-2xl border border-ash-divider bg-white p-4 shadow-card sm:rounded-[26px] sm:p-5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-helper sm:text-xs">
                    Starting price
                  </p>
                  <p className="mt-2 text-xl font-semibold text-portrait-ink sm:mt-3 sm:text-2xl">
                    {data.process.formattedStartingPrice}
                  </p>
                </div>
                <div className="shrink-0 rounded-2xl border border-ash-divider bg-white p-4 shadow-card sm:rounded-[26px] sm:p-5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-helper sm:text-xs">
                    Processing
                  </p>
                  <p className="mt-2 text-xl font-semibold text-portrait-ink sm:mt-3 sm:text-2xl">
                    {data.process.standardEta || 'Varies'}
                  </p>
                </div>
                <div className="shrink-0 rounded-2xl border border-ash-divider bg-white p-4 shadow-card sm:rounded-[26px] sm:p-5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-helper sm:text-xs">
                    Stay duration
                  </p>
                  <p className="mt-2 text-xl font-semibold text-portrait-ink sm:mt-3 sm:text-2xl">
                    {data.process.stayDuration || 'Check rules'}
                  </p>
                </div>
              </div>
            </MotionReveal>

            <PricingPanel
              compact
              countryCode={data.country.iso2Code}
              listingId={data.process.id}
              isFree={data.page.isFree}
              priceOptions={data.page.pricing.priceOptions}
              headline={data.page.pricing.headline}
              visaKinds={data.page.visaKinds}
              currentListingId={data.process.id}
            />
          </section>

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
