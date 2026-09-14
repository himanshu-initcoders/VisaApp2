import { notFound } from 'next/navigation';
import { ApplyVisaWizard } from '@/components/apply/ApplyVisaWizard';
import { getPublicProcessPageData } from '@/lib/db/queries/public';
import { formatFullVisaLabel } from '@/lib/public';

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
  };
}

export default async function ApplyVisaPage({ params, searchParams }: PageProps) {
  const { countryCode, listingId } = await params;
  const query = await searchParams;
  const data = await getPublicProcessPageData(countryCode, listingId);

  if (!data) {
    notFound();
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

  return (
    <ApplyVisaWizard
      countryName={data.country.name}
      countryCode={data.country.iso2Code}
      listingId={data.process.id}
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
    />
  );
}
