import Link from 'next/link';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { requireRole } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { countries, visaListings } from '@/lib/db/schema-extended';
import { PageHeader } from '@/components/admin/PageHeader';
import {
  StartDraftForm,
  type StartDraftListingOption,
  type StartDraftUserOption,
} from '@/components/admin/StartDraftForm';

export default async function AdminStartDraftPage() {
  await requireRole(['admin', 'reviewer']);

  const [applicantUsers, listingRows] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
      })
      .from(users)
      .where(and(eq(users.role, 'user'), isNull(users.deactivatedAt)))
      .orderBy(asc(users.name))
      .limit(500),
    db
      .select({
        id: visaListings.id,
        processName: visaListings.processName,
        countryCode: visaListings.destinationCountry,
        countryName: countries.name,
      })
      .from(visaListings)
      .innerJoin(
        countries,
        eq(countries.iso2Code, visaListings.destinationCountry)
      )
      .orderBy(asc(countries.name), asc(visaListings.processName))
      .limit(500),
  ]);

  const usersOptions: StartDraftUserOption[] = applicantUsers.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
  }));

  const listings: StartDraftListingOption[] = listingRows.map((row) => ({
    id: row.id,
    processName: row.processName,
    countryCode: row.countryCode,
    countryName: row.countryName,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Start draft"
        description="Open the apply form and save a draft for a selected applicant."
        action={
          <Link
            href="/admin/applications/drafts"
            className="font-switzer text-sm text-nautical-teal hover:text-portrait-ink"
          >
            Back to drafts
          </Link>
        }
      />

      <StartDraftForm users={usersOptions} listings={listings} />
    </div>
  );
}
