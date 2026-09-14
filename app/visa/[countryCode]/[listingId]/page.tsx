import { notFound } from 'next/navigation';
import { PublicListingExperience } from '@/components/public/PublicListingExperience';
import { getPublicProcessPageData } from '@/lib/db/queries/public';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    countryCode: string;
    listingId: string;
  }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { countryCode, listingId } = await params;
  const data = await getPublicProcessPageData(countryCode, listingId);

  if (!data) return {};

  return {
    title: `${data.process.processName} for ${data.country.name}`,
    description: `${data.process.processName} for Indian travelers. See pricing, timeline, and document requirements before you start.`,
  };
}

export default async function PublicProcessPage({ params }: PageProps) {
  const { countryCode, listingId } = await params;
  const data = await getPublicProcessPageData(countryCode, listingId);

  if (!data) {
    notFound();
  }

  return <PublicListingExperience initialData={data} />;
}
