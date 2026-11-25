import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { PublicListingExperience } from '@/components/public/PublicListingExperience';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  loadEnabledCountriesWithProcesses,
  getPublicProcessPageData,
} from '@/lib/db/queries/public';
import { getPublishedPostsForCountry } from '@/lib/db/queries/blog';
import { buildProcessHref, getCountryOgImage } from '@/lib/public';
import { toAppMediaUrl } from '@/lib/upload/mediaUrl';
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildVisaServiceJsonLd,
  buildWebPageJsonLd,
} from '@/lib/seo/jsonld';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '@/lib/seo/site';
import { withSearchQuery } from '@/lib/visa/listingSlug';

/**
 * Statically rendered at build time with ISR on-demand revalidation.
 * When changes are made from admin or user panels, revalidatePublicVisaCatalog() immediately purges and refreshes the cache.
 */
export const revalidate = 86400;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{
    countryCode: string;
    listingId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateStaticParams() {
  try {
    // Uncached: avoid baking stale slug paths (→ static 404 HTML) from Data Cache.
    const countries = await loadEnabledCountriesWithProcesses();
    return countries.flatMap((country) =>
      country.visaListings.flatMap((listing) => [
        {
          countryCode: country.iso2Code.toLowerCase(),
          listingId: listing.slug,
        },
        ...(listing.id && listing.id !== listing.slug
          ? [
              {
                countryCode: country.iso2Code.toLowerCase(),
                listingId: listing.id,
              },
            ]
          : []),
      ])
    );
  } catch (error) {
    console.error('generateStaticParams error in visa/[countryCode]/[listingId]:', error);
    return [];
  }
}

function resolveHeroPreloadUrl(
  images?: {
    hero?: { url?: string | null };
    banner?: { url?: string | null };
  } | null
): string | null {
  if (!images) return null;
  const raw = images.hero?.url?.trim() || images.banner?.url?.trim();
  if (!raw) return null;
  return toAppMediaUrl(raw) || raw;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { countryCode, listingId } = await params;
  const data = await getPublicProcessPageData(countryCode, listingId);

  if (!data) return {};

  const countrySeo = data.country.seo;
  const title =
    countrySeo?.metaTitle?.trim() ||
    `${data.country.name} ${data.process.processName} for Indians — price, documents & time`;
  const description =
    countrySeo?.metaDescription?.trim() ||
    `${data.process.processName} for Indian travellers to ${data.country.name}. See pricing, timeline, and document requirements before you apply with ${SITE_NAME}.`;
  const ogImage = getCountryOgImage(data.country.images);
  const keywords = [
    `${data.country.name} visa for Indians`,
    data.process.processName,
    `${data.country.name} ${data.process.purpose || 'visa'}`,
    'visa application India',
    SITE_NAME,
  ].filter(Boolean);

  return buildPageMetadata({
    title,
    description,
    path: data.href,
    keywords,
    ogImage: ogImage
      ? {
          url: ogImage.url,
          alt: ogImage.alt || `${data.country.name} visa`,
          ...(ogImage.width ? { width: ogImage.width } : {}),
          ...(ogImage.height ? { height: ogImage.height } : {}),
        }
      : DEFAULT_OG_IMAGE,
  });
}

export default async function PublicProcessPage({ params, searchParams }: PageProps) {
  const { countryCode, listingId } = await params;
  const data = await getPublicProcessPageData(countryCode, listingId);

  if (!data) {
    notFound();
  }

  // Redirect UUID / wrong slug only. Compare canonical paths (lowercased) so a
  // casing-only mismatch cannot 308-loop onto the same URL.
  if (buildProcessHref(countryCode, listingId) !== data.href) {
    const query = await searchParams;
    permanentRedirect(withSearchQuery(data.href, query));
  }

  const countrySeo = data.country.seo;
  const title =
    countrySeo?.metaTitle?.trim() ||
    `${data.country.name} ${data.process.processName} for Indians — price, documents & time`;
  const description =
    countrySeo?.metaDescription?.trim() ||
    `${data.process.processName} for Indian travellers to ${data.country.name}. See pricing, timeline, and document requirements before you apply with ${SITE_NAME}.`;
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
      { name: 'Destinations', path: '/' },
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

  const heroPreload = resolveHeroPreloadUrl(data.country.images);
  const relatedBlogPosts = await getPublishedPostsForCountry(
    data.country.iso2Code,
    3
  );

  return (
    <>
      {heroPreload ? (
        <link
          rel="preload"
          as="image"
          href={heroPreload}
          fetchPriority="high"
        />
      ) : null}
      <JsonLd data={jsonLd} />
      <PublicListingExperience
        initialData={data}
        relatedBlogPosts={relatedBlogPosts}
      />
    </>
  );
}
