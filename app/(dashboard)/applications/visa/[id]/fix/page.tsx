import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { visaApplicationTravellers, visaApplications } from '@/lib/db/schema';
import {
  emptyTripDetails,
  type ApplyFormConfig,
  type TravellerDocumentUpload,
  type TravellerTripDetails,
} from '@/lib/apply/applicationForm';
import { CorrectionWizard } from '@/components/apply/CorrectionWizard';
import {
  getOpenCorrection,
  listApplicantActionItems,
  type StoredTraveller,
} from '@/lib/visa/corrections';
import type { IndianPassportFields } from '@/lib/passport/types';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ traveller?: string }>;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toPassport(
  data: Record<string, unknown> | null | undefined
): IndianPassportFields {
  const sex = data?.sex;
  return {
    passportNumber: text(data?.passportNumber),
    surname: text(data?.surname),
    givenNames: text(data?.givenNames),
    nationality: text(data?.nationality) || 'IND',
    dateOfBirth: text(data?.dateOfBirth),
    sex: sex === 'M' || sex === 'F' || sex === 'X' ? sex : '',
    dateOfExpiry: text(data?.dateOfExpiry),
    documentType: text(data?.documentType) || 'P',
    countryOfIssue: text(data?.countryOfIssue) || 'IND',
    fathersName: text(data?.fathersName),
    mothersName: text(data?.mothersName),
    spouseName: text(data?.spouseName),
    dateOfIssue: text(data?.dateOfIssue),
    placeOfBirth: text(data?.placeOfBirth),
    placeOfIssue: text(data?.placeOfIssue),
    address: text(data?.address),
    fileNumber: text(data?.fileNumber),
    oldPassportNumber: text(data?.oldPassportNumber),
    oldPassportDateOfIssue: text(data?.oldPassportDateOfIssue),
    oldPassportPlaceOfIssue: text(data?.oldPassportPlaceOfIssue),
    email: text(data?.email),
    phone: text(data?.phone),
  };
}

export default async function FixVisaApplicationPage({
  params,
  searchParams,
}: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  if (session.user.role === 'admin' || session.user.role === 'reviewer') {
    redirect('/admin');
  }

  const { id } = await params;
  const query = await searchParams;

  const [application] = await db
    .select()
    .from(visaApplications)
    .where(
      and(
        eq(visaApplications.id, id),
        eq(visaApplications.userId, session.user.id)
      )
    )
    .limit(1);

  if (!application) notFound();

  const openItems = (await listApplicantActionItems(session.user.id)).filter(
    (item) => item.applicationId === id
  );
  const selected =
    openItems.find((item) => item.travellerId === query.traveller) ??
    openItems[0];
  if (!selected) notFound();

  const open = await getOpenCorrection(id, selected.travellerId);
  if (!open) notFound();

  const config = (application.formSnapshot as ApplyFormConfig | null) ?? null;
  if (!config) notFound();

  const [travellerRow] = await db
    .select({
      passengerId: visaApplicationTravellers.passengerId,
    })
    .from(visaApplicationTravellers)
    .where(eq(visaApplicationTravellers.id, selected.travellerId))
    .limit(1);
  if (!travellerRow) notFound();

  const travellers = Array.isArray(application.travellers)
    ? (application.travellers as StoredTraveller[])
    : [];
  const matched = travellers.find(
    (item) => item.passengerId === travellerRow.passengerId
  );
  if (!matched) notFound();

  const docs = matched.documents ?? [];
  const front = docs.find((doc) => doc.slotKey === 'passport-front');
  const back = docs.find((doc) => doc.slotKey === 'passport-back');
  const uploads: TravellerDocumentUpload[] = docs
    .filter(
      (doc) =>
        doc.slotKey &&
        doc.slotKey !== 'passport-front' &&
        doc.slotKey !== 'passport-back'
    )
    .map((doc) => ({
      key: doc.slotKey || '',
      name: doc.filename || doc.slotKey || 'document',
      previewUrl: doc.url,
      mimeType: doc.mimeType || 'application/octet-stream',
      size: doc.size,
    }));

  return (
    <div className="space-y-6">
      <Link
        href={`/applications/visa/${id}`}
        className="inline-flex items-center font-switzer text-sm text-nautical-teal hover:text-portrait-ink"
      >
        ← Back to application
      </Link>
      <div>
        <h1 className="font-basier text-[40px] leading-tight text-portrait-ink">
          Update {selected.travellerName}
        </h1>
        <p className="mt-2 font-switzer text-base text-slate-helper">
          {selected.country} — {selected.visaType}. Only the requested parts can
          be changed.
        </p>
      </div>
      <CorrectionWizard
        applicationId={id}
        travellerId={selected.travellerId}
        travellerName={selected.travellerName}
        countryName={config.countryName || selected.country}
        listingId={application.visaListingId || id}
        formConfig={config}
        passport={toPassport(matched.passportData)}
        trip={emptyTripDetails(
          (matched.tripDetails ?? undefined) as
            | Partial<TravellerTripDetails>
            | undefined
        )}
        uploads={uploads}
        frontPreviewUrl={front?.url || ''}
        backPreviewUrl={back?.url}
        items={selected.items}
      />
    </div>
  );
}
