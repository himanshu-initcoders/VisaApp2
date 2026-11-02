import { notFound, permanentRedirect } from 'next/navigation';
import { PublicListingExperience } from '@/components/public/PublicListingExperience';
import { getPublicProcessPageData } from '@/lib/db/queries/public';
import { withSearchQuery } from '@/lib/visa/listingSlug';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    countryCode: string;
    listingId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  const query = await searchParams;
  const data = await getPublicProcessPageData(countryCode, listingId);

  if (!data) {
    notFound();
  }

  if (listingId !== data.process.slug) {
    permanentRedirect(withSearchQuery(data.href, query));
  }

  return <PublicListingExperience initialData={data} />;
}
