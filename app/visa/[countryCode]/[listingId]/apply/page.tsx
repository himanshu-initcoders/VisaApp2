import { notFound, permanentRedirect } from 'next/navigation';
import { ApplyVisaWizard } from '@/components/apply/ApplyVisaWizard';
import { JsonLd } from '@/components/seo/JsonLd';
import { auth } from '@/lib/auth';
import { getPublicProcessPageData } from '@/lib/db/queries/public';
import { getApplyPreviousProfiles } from '@/lib/apply/previousProfilesAutofill';
import { getApplicantSummaryForDraft } from '@/lib/apply/serverDraft';
import { formatFullVisaLabel } from '@/lib/public';
import {
  buildBreadcrumbJsonLd,
  buildWebPageJsonLd,
} from '@/lib/seo/jsonld';
import { withSearchQuery } from '@/lib/visa/listingSlug';
import type { TravellerProfile } from '@/lib/apply/travellerProfiles';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    countryCode: string;
    listingId: string;
  }>;
  searchParams: Promise<{
    travellers?: string;
    departure?: string;
    month?: string;
    mode?: string;
    priceOption?: string;
    resume?: string;
    onBehalfOf?: string;
  }>;
}

function formatDepartureLabel(input: {
  mode?: string;
  departure?: string;
  month?: string;
}) {
  if (input.mode === 'flexible' && input.month) {
    const [year, month] = input.month.split('-').map(Number);
    if (!year || !month) return input.month;
    return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    });
  }

  if (input.departure) {
    const date = new Date(`${input.departure}T00:00:00`);
    if (Number.isNaN(date.getTime())) return input.departure;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  if (input.month) {
    const [year, month] = input.month.split('-').map(Number);
    if (!year || !month) return input.month;
    return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    });
  }

  return null;
}

export async function generateMetadata({ params }: PageProps) {
  const { countryCode, listingId } = await params;
  const data = await getPublicProcessPageData(countryCode, listingId);
  if (!data) return {};

  const visaFullName = formatFullVisaLabel({
    countryName: data.country.name,
    purpose: data.process.purpose,
    stayDuration: data.process.stayDuration,
    entryValidity: data.process.entryValidity,
    daysLabel: data.process.priceOptions[0]?.daysLabel,
  });

  return {
    title: `Apply · ${visaFullName}`,
    description: `Complete your ${visaFullName} application.`,
    alternates: { canonical: `${data.href}/apply` },
  };
}

export default async function ApplyVisaPage({ params, searchParams }: PageProps) {
  const { countryCode, listingId } = await params;
  const query = await searchParams;
  const data = await getPublicProcessPageData(countryCode, listingId);

  if (!data) {
    notFound();
  }

  if (listingId !== data.process.slug) {
    permanentRedirect(withSearchQuery(`${data.href}/apply`, query));
  }

  const session = await auth();
  const isStaff =
    session?.user?.role === 'admin' || session?.user?.role === 'reviewer';
  // Applicant-only flag (OTP user). Staff can still apply; profiles use session user.
  const isAuthenticated = Boolean(session?.user?.id && !isStaff);

  let onBehalfOfUserId: string | null = null;
  let onBehalfOfLabel: string | null = null;
  if (isStaff && query.onBehalfOf) {
    const summary = await getApplicantSummaryForDraft(query.onBehalfOf);
    if (summary.success) {
      onBehalfOfUserId = summary.user.id;
      onBehalfOfLabel =
        summary.user.name ||
        (summary.user.phone ? `+91 ${summary.user.phone}` : summary.user.email);
    }
  }

  // Previous profiles always come from Postgres for the acting user
  // (applicant, staff testing as themselves, or staff on-behalf-of).
  let previousProfiles: TravellerProfile[] = [];
  const profilesUserId = onBehalfOfUserId || session?.user?.id || null;
  if (profilesUserId) {
    const serverProfiles = await getApplyPreviousProfiles(profilesUserId);
    previousProfiles = serverProfiles.map((p) => ({
      id: p.id,
      name: p.name,
      nationality: p.nationality,
      countryCode: p.countryCode,
      visaType: p.visaType,
      avatarVariant: p.avatarVariant,
      isServerProfile: true,
      applicationCount: p.applicationCount,
    }));
  }

  const parsedCount = Number.parseInt(query.travellers || '1', 10);
  const initialTravellerCount = Number.isFinite(parsedCount)
    ? Math.min(100, Math.max(1, parsedCount))
    : 1;

  const departureLabel = formatDepartureLabel({
    mode: query.mode,
    departure: query.departure,
    month: query.month,
  });

  const resume = query.resume === '1' || query.resume === 'true';

  const selectedPrice =
    data.process.priceOptions.find((option) => option.id === query.priceOption) ||
    data.process.priceOptions[0];

  const visaFullName = formatFullVisaLabel({
    countryName: data.country.name,
    purpose: data.process.purpose,
    stayDuration: selectedPrice?.stayDuration ?? data.process.stayDuration,
    entryValidity: selectedPrice?.entryValidity ?? data.process.entryValidity,
    daysLabel: selectedPrice?.daysLabel,
  });

  const applyPath = `${data.href}/apply`;

  return (
    <>
      <JsonLd
        data={[
          buildWebPageJsonLd({
            title: `Apply · ${visaFullName}`,
            description: `Complete your ${visaFullName} application.`,
            path: applyPath,
          }),
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Destinations', path: '/destinations' },
            { name: data.country.name, path: data.href },
            { name: 'Apply', path: applyPath },
          ]),
        ]}
      />
      <ApplyVisaWizard
        countryName={data.country.name}
        countryCode={data.country.iso2Code}
        flagUrl={data.country.images?.flag?.url ?? null}
        listingId={data.process.id}
        listingSlug={data.process.slug}
        processName={data.process.processName}
        visaFullName={visaFullName}
        initialTravellerCount={initialTravellerCount}
        departureLabel={departureLabel}
        departureMeta={{
          mode: query.mode,
          departure: query.departure,
          month: query.month,
          label: departureLabel,
          priceOption: query.priceOption,
        }}
        formConfig={data.page.applyForm}
        resume={resume}
        isAuthenticated={isAuthenticated}
        previousProfiles={previousProfiles}
        onBehalfOfUserId={onBehalfOfUserId}
        onBehalfOfLabel={onBehalfOfLabel}
      />
    </>
  );
}
