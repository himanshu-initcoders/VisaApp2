import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { resolveSessionUserId } from '@/lib/auth/session-user';
import {
  formatPassportApplyLabel,
  isPassportServiceType,
} from '@/lib/passport/constants';
import {
  getPassportListingByServiceType,
  getPassportListingWithAllRelations,
} from '@/lib/db/queries/passport-config';
import { getDocumentTypeSamplesByValues } from '@/lib/db/queries/config';
import { buildPassportFormConfig } from '@/lib/apply/passportForm';
import { ApplyPassportWizard } from '@/components/apply/passport-service/ApplyPassportWizard';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  buildBreadcrumbJsonLd,
  buildWebPageJsonLd,
} from '@/lib/seo/jsonld';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ serviceType: string }>;
  searchParams: Promise<{ priceOption?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { serviceType: raw } = await params;
  const query = await searchParams;
  const serviceType = raw.toLowerCase();
  if (!isPassportServiceType(serviceType)) return {};

  const listing = await getPassportListingByServiceType(serviceType);
  if (!listing) return {};

  const full = await getPassportListingWithAllRelations(listing.id);
  const selected =
    full?.prices.find((p) => p.id === query.priceOption) || full?.prices[0];
  const label = formatPassportApplyLabel({
    serviceType,
    scheme: selected?.scheme,
    bookletPages: selected?.bookletPages,
  });
  const title = `Apply · ${label}`;
  const description = `Complete your ${label} application with Viserv. Guided form, document upload, and secure payment.`;
  const canonical = `/passport/${serviceType}/apply`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      images: [{ url: '/indian-passport-banner.jpg', alt: 'Indian passport' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/indian-passport-banner.jpg'],
    },
    // Apply funnel is disallowed in robots.txt; reinforce noindex for HTML crawlers.
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function PassportApplyPage({
  params,
  searchParams,
}: PageProps) {
  const { serviceType: raw } = await params;
  const query = await searchParams;
  const serviceType = raw.toLowerCase();
  if (!isPassportServiceType(serviceType)) {
    notFound();
  }

  const listing = await getPassportListingByServiceType(serviceType);
  if (!listing || !listing.isActive) {
    notFound();
  }

  const full = await getPassportListingWithAllRelations(listing.id);
  if (!full || full.prices.length === 0) notFound();

  const selectedPrice =
    full.prices.find((p) => p.id === query.priceOption) || full.prices[0];

  // Persist selection in the URL (same pattern as visa priceOption).
  if (query.priceOption !== selectedPrice.id) {
    redirect(
      `/passport/${serviceType}/apply?priceOption=${encodeURIComponent(selectedPrice.id)}`
    );
  }

  const documentTypeSamples = await getDocumentTypeSamplesByValues(
    full.componentsRequired.flatMap((item) =>
      [item.documentType, item.key].filter(Boolean) as string[]
    )
  );

  const formConfig = buildPassportFormConfig({
    listing: full,
    formSteps: full.formSteps,
    components: full.componentsRequired,
    documentTypeSamples,
  });

  const session = await auth();
  const userId = session?.user
    ? await resolveSessionUserId(session.user)
    : null;

  const selectionLabel = formatPassportApplyLabel({
    serviceType: full.serviceType,
    scheme: selectedPrice.scheme,
    bookletPages: selectedPrice.bookletPages,
  });
  const pageTitle = `Apply · ${selectionLabel}`;
  const pageDescription = `Complete your ${selectionLabel} application with Viserv. Guided form, document upload, and secure payment.`;
  const applyPath = `/passport/${full.serviceType}/apply`;

  return (
    <>
      <JsonLd
        data={[
          buildWebPageJsonLd({
            title: pageTitle,
            description: pageDescription,
            path: applyPath,
          }),
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Passport', path: '/passport' },
            { name: selectionLabel, path: applyPath },
          ]),
        ]}
      />
      <ApplyPassportWizard
        listingId={full.id}
        serviceType={full.serviceType}
        productName={full.name}
        selectionLabel={selectionLabel}
        formConfig={formConfig}
        priceOptionId={selectedPrice.id}
        prices={full.prices.map((price) => ({
          id: price.id,
          scheme: price.scheme,
          bookletPages: price.bookletPages,
          governmentFeeAmount: price.governmentFeeAmount,
          serviceFeeAmount: price.serviceFeeAmount,
          governmentGstFeeAmount: price.governmentGstFeeAmount,
        }))}
        isSignedIn={Boolean(userId)}
      />
    </>
  );
}
