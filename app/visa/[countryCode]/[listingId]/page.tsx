import { notFound, permanentRedirect } from 'next/navigation';
import { PublicListingExperience } from '@/components/public/PublicListingExperience';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  getEnabledCountriesWithProcesses,
  getPublicProcessPageData,
} from '@/lib/db/queries/public';
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildVisaServiceJsonLd,
  buildWebPageJsonLd,
} from '@/lib/seo/jsonld';
import { withSearchQuery } from '@/lib/visa/listingSlug';

/** Static at build; refresh hourly or when admin emits catalog revalidation. */
export const revalidate = 3600;

interface PageProps {
  params: Promise<{
    countryCode: string;
    listingId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateStaticParams() {
  const countries = await getEnabledCountriesWithProcesses();
  return countries.flatMap((country) =>
    country.visaListings.map((listing) => ({
      countryCode: country.iso2Code.toLowerCase(),
      listingId: listing.slug,
    }))
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { countryCode, listingId } = await params;
  const data = await getPublicProcessPageData(countryCode, listingId);

  if (!data) return {};

  return {
    title: `${data.process.processName} for ${data.country.name}`,
    description: `${data.process.processName} for Indian travelers. See pricing, timeline, and document requirements before you start.`,
    alternates: { canonical: data.href },
  };
}

export default async function PublicProcessPage({ params, searchParams }: PageProps) {
  const { countryCode, listingId } = await params;
  const data = await getPublicProcessPageData(countryCode, listingId);

  if (!data) {
    notFound();
  }

  if (listingId !== data.process.slug) {
    // Only touch searchParams on legacy UUID URLs so slug pages stay static.
    const query = await searchParams;
    permanentRedirect(withSearchQuery(data.href, query));
  }

  const title = `${data.process.processName} for ${data.country.name}`;
  const description = `${data.process.processName} for Indian travelers. See pricing, timeline, and document requirements before you start.`;
  const price = data.page.pricing.priceOptions[0]?.totalAmount;
  const faqSchema = buildFaqPageJsonLd(
    (data.page.faqs ?? []).map((faq) => ({
      question: faq.question,
      answer: faq.answer,
    }))
  );
  const jsonLd = [
    buildWebPageJsonLd({
      title,
      description,
      path: data.href,
    }),
    buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Destinations', path: '/destinations' },
      { name: data.country.name, path: data.href },
      { name: data.process.processName, path: data.href },
    ]),
    buildVisaServiceJsonLd({
      name: title,
      description,
      path: data.href,
      countryName: data.country.name,
      countryCode: data.country.iso2Code,
      price,
      currency: 'INR',
    }),
    ...(faqSchema ? [faqSchema] : []),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <PublicListingExperience initialData={data} />
    </>
  );
}
