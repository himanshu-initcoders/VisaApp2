import { notFound } from 'next/navigation';
import { ApplyVisaWizard } from '@/components/apply/ApplyVisaWizard';
import { getPublicProcessPageData } from '@/lib/db/queries/public';

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

  return {
    title: `Apply · ${data.process.processName} · ${data.country.name}`,
    description: `Complete your ${data.process.processName} application for ${data.country.name}.`,
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

  return (
    <ApplyVisaWizard
      countryName={data.country.name}
      countryCode={data.country.iso2Code}
      listingId={data.process.id}
      processName={data.process.processName}
      initialTravellerCount={initialTravellerCount}
      departureLabel={departureLabel}
      departureMeta={{
        mode: query.mode,
        departure: query.departure,
        month: query.month,
        label: departureLabel,
        priceOption: query.priceOption,
      }}
      resume={resume}
    />
  );
}
