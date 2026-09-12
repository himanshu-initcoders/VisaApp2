import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { HomeLandingClient } from '@/components/public/HomeLandingClient';
import { MotionReveal } from '@/components/public/MotionReveal';
import { ProcessTimeline } from '@/components/public/ProcessTimeline';
import { getEnabledCountriesWithProcesses } from '@/lib/db/queries/public';

export const dynamic = 'force-dynamic';

const HOW_IT_WORKS_STEPS = [
  {
    id: 'destination',
    title: 'Pick a destination',
    description:
      'Search a country and open the visa that matches your trip — tourist, business, or study.',
    stepNumber: 1,
  },
  {
    id: 'docs',
    title: 'See documents and price',
    description:
      'Know the fee breakdown, processing time, and exactly which papers to keep ready.',
    stepNumber: 2,
  },
  {
    id: 'apply',
    title: 'Apply in one flow',
    description:
      'Add travellers, upload files, and pay. We check the application before it is filed.',
    stepNumber: 3,
  },
  {
    id: 'track',
    title: 'Track until it is done',
    description:
      'Get status updates as the visa moves — no embassy queues, no guessing what happens next.',
    stepNumber: 4,
  },
];

export default async function Home() {
  const countriesWithProcesses = await getEnabledCountriesWithProcesses();
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
      standardEta: process.standardEta,
      standardEtaDuration: process.standardEtaDuration,
      standardEtaUnit: process.standardEtaUnit,
    }));

    const cheapest = listings.reduce((lowest, listing) =>
      listing.startingPrice < lowest.startingPrice ? listing : lowest
    );

    return {
      name: country.name,
      iso2Code: country.iso2Code,
      images: country.images,
      href: cheapest.href,
      startingPrice: cheapest.startingPrice,
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

  return (
    <>
      <main className="min-h-screen bg-[#f8f6f1]">
        <HomeLandingClient countries={countries} processes={allProcesses} />

        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
          <MotionReveal className="mb-8 max-w-2xl sm:mb-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-helper">
              How it works
            </p>
            <h2 className="mt-2 font-basier text-2xl leading-tight tracking-[-0.03em] text-portrait-ink sm:text-4xl">
              Four calm steps to a visa.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-helper sm:text-base sm:leading-7">
              Built so first-timers are not guessing, and frequent travellers
              are not repeating themselves.
            </p>
          </MotionReveal>
          <ProcessTimeline steps={HOW_IT_WORKS_STEPS} />
          <Link
            href="/how-it-works"
            className="mt-6 inline-flex items-center text-sm font-medium text-portrait-ink"
          >
            See the full process
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 sm:pb-20 lg:px-8">
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
                className="mt-7 inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-portrait-ink transition-transform active:scale-[0.98] sm:text-base"
              >
                Apply for Indian passport
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
            <div className="relative hidden min-h-[220px] items-center justify-center bg-[#08304c] px-10 lg:flex">
              <p className="font-script max-w-[220px] -rotate-[8deg] text-right text-4xl leading-tight text-white/90">
                Travel starts at home
              </p>
            </div>
          </MotionReveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
