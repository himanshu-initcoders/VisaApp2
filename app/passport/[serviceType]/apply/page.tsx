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

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ serviceType: string }>;
  searchParams: Promise<{ priceOption?: string }>;
}

export async function generateMetadata({ params, searchParams }: PageProps) {
  const { serviceType: raw } = await params;
  const query = await searchParams;
  const serviceType = raw.toLowerCase();
  if (!isPassportServiceType(serviceType)) return {};

  const listing = await getPassportListingByServiceType(serviceType);
  if (!listing) return {};

  const full = await getPassportListingWithAllRelations(listing.id);
  const selected =
    full?.prices.find((p) => p.id === query.priceOption) || full?.prices[0];
  const title = formatPassportApplyLabel({
    serviceType,
    scheme: selected?.scheme,
    bookletPages: selected?.bookletPages,
  });

  return {
    title: `Apply · ${title}`,
    description: `Complete your ${title} application.`,
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

  return (
    <ApplyPassportWizard
      listingId={full.id}
      serviceType={full.serviceType}
      productName={full.name}
      selectionLabel={selectionLabel}
      formConfig={formConfig}
      priceOptionId={selectedPrice.id}
      selectedPrice={{
        id: selectedPrice.id,
        scheme: selectedPrice.scheme,
        bookletPages: selectedPrice.bookletPages,
        governmentFeeAmount: selectedPrice.governmentFeeAmount,
        serviceFeeAmount: selectedPrice.serviceFeeAmount,
        governmentGstFeeAmount: selectedPrice.governmentGstFeeAmount,
      }}
      isSignedIn={Boolean(userId)}
    />
  );
}
