import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MotionReveal } from '@/components/public/MotionReveal';
import { PublicProcessCard } from '@/components/public/PublicProcessCard';
import { JsonLd } from '@/components/seo/JsonLd';
import { getEnabledCountriesWithProcesses } from '@/lib/db/queries/public';
import {
  buildBreadcrumbJsonLd,
  buildWebPageJsonLd,
} from '@/lib/seo/jsonld';

/** Static at build; refresh hourly or when admin emits catalog revalidation. */
export const revalidate = 3600;

export default async function DestinationsPage() {
  const countriesWithProcesses = await getEnabledCountriesWithProcesses();
  const processes = countriesWithProcesses.flatMap((country) =>
    country.visaListings.map((process) => ({
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
      <JsonLd
        data={[
          buildWebPageJsonLd({
            title: 'Visa destinations — Viserv',
            description:
              'Browse every live visa and arrival-card page. Pricing, documents, and timelines stay aligned with what operations has enabled.',
            path: '/destinations',
          }),
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Destinations', path: '/destinations' },
          ]),
        ]}
      />
      <Header />
      <main className="min-h-screen bg-[#f8f6f1] px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-10">
          <MotionReveal className="max-w-3xl space-y-4">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-helper">
              Destinations
            </p>
            <h1 className="font-basier text-5xl leading-tight text-portrait-ink">
              Every live visa and arrival-card page in one place.
            </h1>
            <p className="text-base leading-8 text-slate-helper">
              This list is driven directly by normalized country and process
              records, so marketing pages stay aligned with what your operations
              team has actually enabled.
            </p>
          </MotionReveal>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {processes.map((process, index) => (
              <MotionReveal key={process.id} delayMs={index * 40}>
                <PublicProcessCard process={process} />
              </MotionReveal>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
