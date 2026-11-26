import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { FaqAccordion } from '@/components/public/FaqAccordion';
import { MotionReveal } from '@/components/public/MotionReveal';
import { PublicProcessCard } from '@/components/public/PublicProcessCard';
import { JsonLd } from '@/components/seo/JsonLd';
import { MediaImage } from '@/components/shared/MediaImage';
import { sanitizeBlogHtml } from '@/lib/blog/sanitize';
import {
  getCountryWithProcesses,
  loadEnabledCountriesWithProcesses,
} from '@/lib/db/queries/public';
import { getCountryCardImage, getCountryOgImage, getFlagEmoji } from '@/lib/public';
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildItemListJsonLd,
  buildWebPageJsonLd,
} from '@/lib/seo/jsonld';
import {
  buildCountryHubFaqs,
  buildCountryHubPath,
} from '@/lib/seo/countryHubFaqs';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { DEFAULT_OG_IMAGE, SITE_NAME } from '@/lib/seo/site';
import { toAppMediaUrl } from '@/lib/upload/mediaUrl';

export const revalidate = 3600;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ countryCode: string }>;
}

export async function generateStaticParams() {
  try {
    const countries = await loadEnabledCountriesWithProcesses();
    return countries.map((country) => ({
      countryCode: country.iso2Code.toLowerCase(),
    }));
  } catch (error) {
    console.error('generateStaticParams error in visa/[countryCode]:', error);
    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { countryCode } = await params;
  const country = await getCountryWithProcesses(countryCode.toUpperCase());
  if (!country || country.visaListings.length === 0) return {};

  const path = buildCountryHubPath(country.iso2Code);
  const countrySeo = country.seo;
  const title =
    countrySeo?.metaTitle?.trim() ||
    `${country.name} visa for Indians — types, price & documents`;
  const description =
    countrySeo?.metaDescription?.trim() ||
    `Compare ${country.name} visa options for Indian travellers on ${SITE_NAME}: pricing, processing time, and document checklists before you apply.`;
  const ogImage = getCountryOgImage(country.images);

  return buildPageMetadata({
    title,
    description,
    path,
    keywords: [
      `${country.name} visa for Indians`,
      `${country.name} tourist visa`,
      `${country.name} visa documents`,
      `${country.name} visa price`,
      SITE_NAME,
    ],
    ogImage: ogImage
      ? {
          url: ogImage.url,
          alt: ogImage.alt || `${country.name} visa`,
          ...(ogImage.width ? { width: ogImage.width } : {}),
          ...(ogImage.height ? { height: ogImage.height } : {}),
        }
      : DEFAULT_OG_IMAGE,
  });
}

export default async function CountryVisaHubPage({ params }: PageProps) {
  const { countryCode } = await params;
  const country = await getCountryWithProcesses(countryCode.toUpperCase());

  if (!country || country.visaListings.length === 0) {
    notFound();
  }

  const path = buildCountryHubPath(country.iso2Code);
  const countrySeo = country.seo;
  const title =
    countrySeo?.metaTitle?.trim() ||
    `${country.name} visa for Indians — types, price & documents`;
  const description =
    countrySeo?.metaDescription?.trim() ||
    `Compare ${country.name} visa options for Indian travellers on ${SITE_NAME}: pricing, processing time, and document checklists before you apply.`;
  const headline =
    countrySeo?.headline?.trim() ||
    `Choose the ${country.name} visa that fits your trip.`;

  const faqs = buildCountryHubFaqs({
    countryName: country.name,
    listings: country.visaListings.map((listing) => ({
      processName: listing.processName,
      purpose: listing.purpose,
      formattedStartingPrice: listing.formattedStartingPrice,
      startingPrice: listing.startingPrice,
      standardEta: listing.standardEta,
      isFree: listing.isFree,
    })),
  });
  const faqSchema = buildFaqPageJsonLd(
    faqs.map((faq) => ({ question: faq.question, answer: faq.answer }))
  );

  const exemptionHtml = country.exemption
    ? sanitizeBlogHtml(country.exemption)
    : '';
  const hasExemption =
    exemptionHtml.replace(/<[^>]*>/g, '').trim().length > 0;

  const cardImage = getCountryCardImage(country.images);
  const heroUrl = cardImage?.url
    ? toAppMediaUrl(cardImage.url) || cardImage.url
    : null;

  const jsonLd = [
    buildWebPageJsonLd({
      title,
      description,
      path,
    }),
    buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: country.name, path },
    ]),
    buildItemListJsonLd({
      name: `${country.name} visas for Indians`,
      description,
      path,
      items: country.visaListings.map((listing) => ({
        name: listing.processName,
        path: listing.href,
      })),
    }),
    ...(faqSchema ? [faqSchema] : []),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <Header />
      <main className="min-h-screen bg-[#f8f6f1]">
        <section className="relative overflow-hidden border-b border-ash-divider/60">
          <div className="absolute inset-0">
            {heroUrl ? (
              <MediaImage
                src={heroUrl}
                alt={cardImage?.alt || `${country.name} travel`}
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
            ) : (
              <div className="h-full w-full bg-[#08304c]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#041525] via-[#041525]/65 to-[#041525]/25" />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-32 sm:px-6 sm:pb-16 sm:pt-36 lg:px-8">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/65">
              {getFlagEmoji(country.iso2Code)} {country.name}
            </p>
            <h1 className="mt-3 max-w-3xl font-basier text-4xl leading-tight tracking-[-0.04em] text-white sm:text-5xl">
              {country.name} visa for Indians
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/78 sm:text-base sm:leading-8">
              {headline}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65 sm:text-[15px]">
              {description}
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-7xl space-y-14 px-4 py-10 sm:space-y-16 sm:px-6 sm:py-14 lg:px-8">
          <section className="space-y-6 sm:space-y-8">
            <MotionReveal className="max-w-2xl space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-helper">
                Visa options
              </p>
              <h2 className="font-basier text-2xl tracking-[-0.03em] text-portrait-ink sm:text-4xl">
                Pick a {country.name} visa to see price and documents
              </h2>
            </MotionReveal>

            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3">
              {country.visaListings.map((listing) => (
                <PublicProcessCard
                  key={listing.id}
                  process={{
                    id: listing.id,
                    href: listing.href,
                    processName: listing.processName,
                    processType: listing.processType,
                    processTypeLabel: listing.processTypeLabel,
                    formattedStartingPrice: listing.formattedStartingPrice,
                    standardEta: listing.standardEta,
                    startingPrice: listing.startingPrice,
                    isFree: listing.isFree,
                    withFreeInsurance: listing.withFreeInsurance,
                    country: {
                      name: country.name,
                      iso2Code: country.iso2Code,
                      images: country.images,
                    },
                  }}
                />
              ))}
            </div>
          </section>

          {hasExemption ? (
            <section
              id="exemption"
              className="scroll-mt-32 space-y-5 sm:scroll-mt-36"
            >
              <MotionReveal className="max-w-2xl space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-helper">
                  Visa exemption
                </p>
                <h2 className="font-basier text-2xl text-portrait-ink sm:text-4xl">
                  Who may be exempt?
                </h2>
              </MotionReveal>
              <MotionReveal>
                <div
                  className="max-w-3xl space-y-4 text-[15px] leading-7 text-portrait-ink sm:text-base sm:leading-8 [&_a]:text-nautical-teal [&_a]:underline [&_h2]:font-basier [&_h2]:text-2xl [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:font-basier [&_h3]:text-xl [&_h3]:mt-6 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3"
                  dangerouslySetInnerHTML={{ __html: exemptionHtml }}
                />
              </MotionReveal>
            </section>
          ) : null}

          <section id="faqs" className="scroll-mt-32 space-y-5 sm:scroll-mt-36">
            <MotionReveal className="max-w-2xl space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-helper">
                FAQs
              </p>
              <h2 className="font-basier text-2xl text-portrait-ink sm:text-4xl">
                {country.name} visa questions
              </h2>
            </MotionReveal>
            <FaqAccordion faqs={faqs} />
          </section>

          <MotionReveal>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-nautical-teal transition-colors hover:text-portrait-ink"
            >
              Browse all destinations
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          </MotionReveal>
        </div>
      </main>
      <Footer />
    </>
  );
}
