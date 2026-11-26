import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { ContactBar } from '@/components/public/ContactBar';
import { HomeLandingClient } from '@/components/public/HomeLandingClient';
import { MotionReveal } from '@/components/public/MotionReveal';
import { ProcessTimeline } from '@/components/public/ProcessTimeline';
import { RecentBlogsSection } from '@/components/public/RecentBlogsSection';
import { WhatsAppFloat } from '@/components/public/WhatsAppFloat';
import { JsonLd } from '@/components/seo/JsonLd';
import { getRecentPublishedPosts } from '@/lib/db/queries/blog';
import {
  getEnabledComingSoonCountries,
  getEnabledCountriesWithProcesses,
} from '@/lib/db/queries/public';
import { SiteFaqSection } from '@/components/public/SiteFaqSection';
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildHowToJsonLd,
  buildWebPageJsonLd,
} from '@/lib/seo/jsonld';
import { HOW_IT_WORKS_STEPS } from '@/lib/seo/howItWorksSteps';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SEO_PAGES } from '@/lib/seo/pages';
import { SITE_FAQS } from '@/lib/seo/siteFaqs';
import { pickPreferredCountryListing } from '@/lib/visa/purposes';

/** Static at build; refresh hourly or when admin emits catalog revalidation. */
export const revalidate = 3600;

const HOME = SEO_PAGES.home;
const HOME_H1 = 'Visa and passport services for Indian citizens';

export const metadata: Metadata = buildPageMetadata({
  title: HOME.titleAbsolute,
  absoluteTitle: HOME.titleAbsolute,
  description: HOME.description,
  path: HOME.path,
  keywords: HOME.keywords,
});

export default async function Home() {
  const [countriesWithProcesses, comingSoonCountries, recentPosts] =
    await Promise.all([
      getEnabledCountriesWithProcesses(),
      getEnabledComingSoonCountries(),
      getRecentPublishedPosts(3),
    ]);
  type CountryWithProcesses = (typeof countriesWithProcesses)[number];
  type VisaListing = CountryWithProcesses['visaListings'][number];

  const countries = countriesWithProcesses.map((country: CountryWithProcesses) => {
    const listings = country.visaListings.map((process: VisaListing) => ({
      id: process.id,
      href: process.href,
      processName: process.processName,
      processType: process.processType,
      processTypeLabel: process.processTypeLabel,
      purpose: process.purpose,
      formattedStartingPrice: process.formattedStartingPrice,
      startingPrice: process.startingPrice,
      isFree: process.isFree,
      standardEta: process.standardEta,
      standardEtaDuration: process.standardEtaDuration,
      standardEtaUnit: process.standardEtaUnit,
      withFreeInsurance: process.withFreeInsurance,
    }));

    // Card price + click target: tourism → business → any other purpose.
    const preferred = pickPreferredCountryListing(listings) ?? listings[0];

    return {
      name: country.name,
      iso2Code: country.iso2Code,
      images: country.images,
      href: preferred.href,
      startingPrice: preferred.startingPrice,
      isFree: preferred.isFree,
      listings,
    };
  });

  const allProcesses = countries.flatMap((country) =>
    country.listings.map((listing) => ({
      ...listing,
      country: {
        name: country.name,
        iso2Code: country.iso2Code,
        images: country.images,
      },
    }))
  );

  const faqSchema = buildFaqPageJsonLd(
    SITE_FAQS.map((faq) => ({
      question: faq.question,
      answer: faq.answer,
    }))
  );

  return (
    <>
      {/* LCP hero: discoverable in initial HTML before the client LandingHero tree. */}
      <link
        rel="preload"
        as="image"
        href="/hero.webp"
        type="image/webp"
        fetchPriority="high"
      />
      <JsonLd
        data={[
          buildWebPageJsonLd({
            title: HOME.titleAbsolute,
            description: HOME.description,
            path: HOME.path,
          }),
          buildBreadcrumbJsonLd([{ name: 'Home', path: '/' }]),
          buildHowToJsonLd({
            name: 'Apply for a visa with Viserv in four steps',
            description: HOME.description,
            path: HOME.path,
            steps: HOW_IT_WORKS_STEPS.map((step) => ({
              title: step.title,
              description: step.description,
              stepNumber: step.stepNumber,
            })),
          }),
          ...(faqSchema ? [faqSchema] : []),
        ]}
      />
      <main className="min-h-screen bg-[#f8f6f1]">
        <h1 className="sr-only">{HOME_H1}</h1>
        <HomeLandingClient
          countries={countries}
          processes={allProcesses}
          comingSoonCountries={comingSoonCountries}
        />

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <MotionReveal className="mb-8 max-w-2xl sm:mb-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-helper">
              How it works
            </p>
            <h2 className="mt-2 font-basier text-2xl leading-tight tracking-[-0.03em] text-portrait-ink sm:text-4xl">
              Your visa in four simple steps
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-helper sm:text-base sm:leading-7">
              Clear guidance for first-time travellers, and no repeated paperwork for frequent ones.
            </p>
          </MotionReveal>
          <ProcessTimeline steps={[...HOW_IT_WORKS_STEPS]} />
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-8 pt-2 sm:px-6 sm:pb-10 sm:pt-4 lg:px-8">
          <MotionReveal className="grid overflow-hidden rounded-[28px] bg-[#062445] text-white shadow-elevated sm:rounded-[36px] lg:grid-cols-[1.1fr_0.9fr]">
            <div className="px-5 py-10 sm:px-10 sm:py-12">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
                Passport services
              </p>
              <h2 className="mt-3 font-basier text-2xl leading-tight sm:text-4xl">
                Need an Indian passport too?
              </h2>
              <p className="mt-3 max-w-lg text-[15px] leading-7 text-white/72 sm:text-base">
                New passport, renewal, or updates — the same clear documents,
                fees, and tracking you get on visas.
              </p>
              <Link
                href="/passport"
                className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-portrait-ink transition-transform active:scale-[0.98] sm:text-base"
              >
                Apply for Indian passport
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
            </div>
            <div className="relative hidden min-h-[220px] items-center justify-center bg-[#08304c] px-10 lg:flex">
              <p className="font-script max-w-[220px] -rotate-[8deg] text-right text-4xl leading-tight text-white/90">
                Travel starts at home
              </p>
            </div>
          </MotionReveal>
        </section>

        <SiteFaqSection />
        <RecentBlogsSection posts={recentPosts} compactBottom />
        <ContactBar />
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
