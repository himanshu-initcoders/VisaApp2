'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
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
import { loadPublicListingPage } from '@/app/visa/loadPublicListing';
import type { PublicProcessPageData } from '@/lib/db/queries/public';
import type { VisaKindOption } from '@/components/public/PricingPanel';

const listingCache = new Map<string, PublicProcessPageData>();

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'requirements', label: 'Requirements' },
  // { id: 'process', label: 'Process' },
  { id: 'faqs', label: 'FAQs' },
];

function cacheKey(countryCode: string, listingId: string) {
  return `${countryCode.toLowerCase()}:${listingId}`;
}

function listingIdFromPath(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'visa' || segments.length < 3) return null;
  if (segments[3] === 'apply') return null;
  return segments[2] || null;
}

function applyListingDocument(next: PublicProcessPageData, updateUrl: boolean) {
  document.title = `${next.process.processName} for ${next.country.name}`;
  if (updateUrl && window.location.pathname !== next.href) {
    window.history.pushState(null, '', next.href);
  }
}

async function readListing(
  countryCode: string,
  listingId: string
): Promise<PublicProcessPageData | null> {
  const key = cacheKey(countryCode, listingId);
  const cached = listingCache.get(key);
  if (cached) return cached;

  const loaded = await loadPublicListingPage({ countryCode, listingId });
  if (loaded) listingCache.set(key, loaded);
  return loaded;
}

export function PublicListingExperience({
  initialData,
}: {
  initialData: PublicProcessPageData;
}) {
  const pathname = usePathname();
  const [data, setData] = useState(initialData);
  const dataRef = useRef(data);
  const activeIdRef = useRef(initialData.process.id);
  const requestRef = useRef(0);

  dataRef.current = data;
  listingCache.set(
    cacheKey(initialData.country.iso2Code, initialData.process.id),
    initialData
  );

  const showListing = useCallback(
    (next: PublicProcessPageData, updateUrl: boolean) => {
      listingCache.set(
        cacheKey(next.country.iso2Code, next.process.id),
        next
      );
      activeIdRef.current = next.process.id;
      setData(next);
      applyListingDocument(next, updateUrl);
    },
    []
  );

  const switchListing = useCallback(
    async (listingId: string, updateUrl: boolean) => {
      if (listingId === activeIdRef.current) return true;

      activeIdRef.current = listingId;
      const requestId = ++requestRef.current;
      const next = await readListing(
        dataRef.current.country.iso2Code,
        listingId
      );

      if (requestId !== requestRef.current) return false;
      if (!next) {
        activeIdRef.current = dataRef.current.process.id;
        return false;
      }

      showListing(next, updateUrl);
      return true;
    },
    [showListing]
  );

  useEffect(() => {
    const siblings = data.page.visaKinds;
    const countryCode = data.country.iso2Code;
    const currentId = data.process.id;

    siblings.forEach((kind) => {
      if (kind.id === currentId) return;
      if (listingCache.has(cacheKey(countryCode, kind.id))) return;
      void readListing(countryCode, kind.id);
    });
  }, [data.country.iso2Code, data.page.visaKinds, data.process.id]);

  useEffect(() => {
    const pathListingId = listingIdFromPath(pathname);
    if (!pathListingId || pathListingId === activeIdRef.current) return;
    void switchListing(pathListingId, false);
  }, [pathname, switchListing]);

  const onVisaKindSelect = useCallback(
    async (kind: VisaKindOption) => switchListing(kind.id, true),
    [switchListing]
  );

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
          items={NAV_ITEMS}
          className="border-ash-divider/40 bg-[#f8f6f1]/95"
        />

        <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:space-y-20 sm:px-6 sm:py-16 lg:px-8">
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
            onVisaKindSelect={onVisaKindSelect}
          />

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

          {/* Process section — hidden for now */}
          {false && (
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
          )}

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
