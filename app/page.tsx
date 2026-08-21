import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HomeLandingClient } from '@/components/public/HomeLandingClient';
import { MotionReveal } from '@/components/public/MotionReveal';
import { getEnabledCountriesWithProcesses } from '@/lib/db/queries/public';

// Always read live catalog so admin adds show up on Vercel without a redeploy
export const dynamic = 'force-dynamic';

export default async function Home() {
  const countriesWithProcesses = await getEnabledCountriesWithProcesses();
  type CountryWithProcesses = (typeof countriesWithProcesses)[number];
  type VisaListing = CountryWithProcesses['visaListings'][number];

  const allProcesses = countriesWithProcesses.flatMap((country: CountryWithProcesses) =>
    country.visaListings.map((process: VisaListing) => ({
      ...process,
      country: {
        name: country.name,
        iso2Code: country.iso2Code,
        images: country.images,
      },
    }))
  );

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8f6f1]">
        <HomeLandingClient processes={allProcesses} />

        {allProcesses.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
            <MotionReveal className="rounded-2xl bg-[#0b1220] px-5 py-10 text-center text-white shadow-elevated sm:rounded-[36px] sm:px-10 sm:py-12">
              <p className="text-xs uppercase tracking-[0.24em] text-white/60 sm:text-sm">
                Built for smoother starts
              </p>
              <h2 className="mt-3 font-basier text-2xl leading-tight sm:mt-4 sm:text-4xl lg:text-5xl">
                Turn country data into calm, trustworthy pages.
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-7 text-white/72 sm:mt-4 sm:text-base">
                Every destination page now flows from the same database records
                your admin tools manage, so marketing stays aligned with live
                products, pricing, and requirements.
              </p>
            </MotionReveal>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
