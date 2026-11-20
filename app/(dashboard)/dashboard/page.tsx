import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { redirectStaffToAdmin } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { visaApplications, passportServices, payments } from '@/lib/db/schema';
import { and, eq, desc, ne, sql, inArray } from 'drizzle-orm';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from '@/components/ui';
import { PaymentHistory } from '@/components/applications/PaymentHistory';
import { loadTravellerSummaries } from '@/lib/visa/travellerStatus';
import { listApplicantActionItems } from '@/lib/visa/corrections';
import { listPassportApplicantActionItems } from '@/lib/passport/corrections';
import { ActionRequiredBanner } from '@/components/dashboard/ActionRequiredBanner';
import { PassportActionRequiredBanner } from '@/components/dashboard/PassportActionRequiredBanner';
import { DraftApplicationsList } from '@/components/dashboard/DraftApplicationsList';
import { UserApplicationListItem } from '@/components/dashboard/UserApplicationListItem';
import { SubmissionConfirmationTracker } from '@/components/analytics/SubmissionConfirmationTracker';
import { listMyApplicationDrafts } from '@/lib/apply/serverDraft';
import { listMyPassportDrafts } from '@/lib/apply/passportDraftActions';
import { getCountryFlagMap } from '@/lib/countries/flags';
import { loadVisaOutcomePresence } from '@/lib/visa/outcomeDocument';
import Link from 'next/link';

/** Dashboard home only shows a short slice; full lists live under /applications/*. */
const DRAFT_LIMIT = 3;
const RECENT_LIMIT = 5;
const PAYMENT_LIMIT = 5;

const VISA_IN_PROGRESS = ['submitted', 'under_review', 'action_required'] as const;
const PASSPORT_IN_PROGRESS = [
  'submitted',
  'under_review',
  'action_required',
  'in_progress',
] as const;
const PASSPORT_APPROVED = ['approved', 'completed'] as const;

function formatAppDate(date: Date | string) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

function passportTitle(serviceType: string | null | undefined) {
  if (serviceType === 'reissue') return 'Passport reissue';
  if (serviceType === 'fresh') return 'New passport';
  return serviceType ? `Passport · ${serviceType}` : 'Passport';
}

/**
 * Applicant dashboard — overview with capped lists and canonical app URLs.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ submitted?: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect('/signin');
  }
  redirectStaffToAdmin(session.user.role);

  const params = searchParams ? await searchParams : {};
  const submittedId = params.submitted;
  const firstName = session.user.name?.split(' ')[0] || 'traveller';
  const userId = session.user.id;

  const [
    visaCountRow,
    passportCountRow,
    visaInProgressRow,
    passportInProgressRow,
    visaApprovedRow,
    passportApprovedRow,
    visaRecent,
    passportRecent,
    draftsResult,
    passportDraftsResult,
    paymentRows,
    actionItems,
    passportActionItems,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(visaApplications)
      .where(
        and(eq(visaApplications.userId, userId), ne(visaApplications.status, 'draft'))
      )
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(passportServices)
      .where(
        and(eq(passportServices.userId, userId), ne(passportServices.status, 'draft'))
      )
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(visaApplications)
      .where(
        and(
          eq(visaApplications.userId, userId),
          inArray(visaApplications.status, [...VISA_IN_PROGRESS])
        )
      )
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(passportServices)
      .where(
        and(
          eq(passportServices.userId, userId),
          inArray(passportServices.status, [...PASSPORT_IN_PROGRESS])
        )
      )
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(visaApplications)
      .where(
        and(
          eq(visaApplications.userId, userId),
          eq(visaApplications.status, 'approved')
        )
      )
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(passportServices)
      .where(
        and(
          eq(passportServices.userId, userId),
          inArray(passportServices.status, [...PASSPORT_APPROVED])
        )
      )
      .then((rows) => rows[0]?.count ?? 0),
    db
      .select({
        id: visaApplications.id,
        country: visaApplications.country,
        countryCode: visaApplications.countryCode,
        visaType: visaApplications.visaType,
        referenceNumber: visaApplications.referenceNumber,
        status: visaApplications.status,
        submittedAt: visaApplications.submittedAt,
        createdAt: visaApplications.createdAt,
      })
      .from(visaApplications)
      .where(
        and(eq(visaApplications.userId, userId), ne(visaApplications.status, 'draft'))
      )
      .orderBy(desc(visaApplications.submittedAt), desc(visaApplications.createdAt))
      .limit(RECENT_LIMIT),
    db
      .select({
        id: passportServices.id,
        serviceType: passportServices.serviceType,
        referenceNumber: passportServices.referenceNumber,
        status: passportServices.status,
        submittedAt: passportServices.submittedAt,
        createdAt: passportServices.createdAt,
      })
      .from(passportServices)
      .where(
        and(eq(passportServices.userId, userId), ne(passportServices.status, 'draft'))
      )
      .orderBy(desc(passportServices.submittedAt), desc(passportServices.createdAt))
      .limit(RECENT_LIMIT),
    listMyApplicationDrafts(),
    listMyPassportDrafts(),
    db
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        paymentMethod: payments.paymentMethod,
        razorpayPaymentId: payments.razorpayPaymentId,
        razorpayOrderId: payments.razorpayOrderId,
        razorpayRefundId: payments.razorpayRefundId,
        kind: payments.kind,
        parentPaymentId: payments.parentPaymentId,
        createdAt: payments.createdAt,
        completedAt: payments.completedAt,
        applicationId: payments.applicationId,
        applicationType: payments.applicationType,
        visaCountry: visaApplications.country,
        visaCountryCode: visaApplications.countryCode,
        visaType: visaApplications.visaType,
        visaReference: visaApplications.referenceNumber,
        passportServiceType: passportServices.serviceType,
        passportReference: passportServices.referenceNumber,
      })
      .from(payments)
      .leftJoin(
        visaApplications,
        and(
          eq(payments.applicationId, visaApplications.id),
          eq(payments.applicationType, 'visa'),
          eq(visaApplications.userId, userId)
        )
      )
      .leftJoin(
        passportServices,
        and(
          eq(payments.applicationId, passportServices.id),
          eq(payments.applicationType, 'passport'),
          eq(passportServices.userId, userId)
        )
      )
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt))
      .limit(PAYMENT_LIMIT),
    listApplicantActionItems(userId),
    listPassportApplicantActionItems(userId),
  ]);

  const visaDrafts = draftsResult.success ? draftsResult.drafts : [];
  const passportDrafts = passportDraftsResult.success
    ? passportDraftsResult.drafts.map((d) => ({
        id: d.id,
        listingId: d.listingId,
        listingSlug: d.listingSlug ?? null,
        countryCode: 'IN',
        referenceNumber: d.referenceNumber,
        updatedAt: d.updatedAt,
        kind: 'passport' as const,
        passportServiceType: d.serviceType,
        payload: {
          version: 1,
          updatedAt: d.updatedAt,
          countryCode: 'IN',
          countryName: 'India',
          listingId: d.listingId,
          processName: d.serviceType,
          step: 'form',
          primaryName: '',
          travellers: [],
          departure: {},
          travellersCount: 1,
        },
      }))
    : [];

  const drafts = [...visaDrafts, ...passportDrafts]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, DRAFT_LIMIT);

  const totalApplications = visaCountRow + passportCountRow;
  const draftCount = visaDrafts.length + passportDrafts.length;
  const inProgress =
    visaInProgressRow + passportInProgressRow + draftCount;
  const approved = visaApprovedRow + passportApprovedRow;

  const [summaries, flagUrls, outcomePresence] = await Promise.all([
    loadTravellerSummaries(visaRecent.map((app) => app.id)),
    getCountryFlagMap([
      ...drafts.map((d) => d.countryCode || d.payload.countryCode),
      ...visaRecent.map((app) => app.countryCode),
    ]),
    loadVisaOutcomePresence(visaRecent.map((app) => app.id)),
  ]);

  const recent = [
    ...visaRecent.map((app) => {
      const summary = summaries.get(app.id);
      const date = app.submittedAt || app.createdAt;
      return {
        id: app.id,
        kind: 'visa' as const,
        title: `${app.country || app.countryCode || 'Visa'} · ${app.visaType}`,
        countryCode: app.countryCode,
        reference: app.referenceNumber || app.id.slice(0, 8),
        status: app.status,
        travellerCount: summary?.travellerCount ?? 0,
        approvedTravellerCount: summary?.approvedCount ?? 0,
        date,
        dateLabel: formatAppDate(date),
        href: `/applications/visa/${app.referenceNumber || app.id}`,
        documentReady: outcomePresence.has(app.id),
      };
    }),
    ...passportRecent.map((app) => {
      const date = app.submittedAt || app.createdAt;
      return {
        id: app.id,
        kind: 'passport' as const,
        title: passportTitle(app.serviceType),
        countryCode: null as string | null,
        reference: app.referenceNumber || app.id.slice(0, 8),
        status: app.status,
        travellerCount: 0,
        approvedTravellerCount: 0,
        date,
        dateLabel: formatAppDate(date),
        href: `/applications/passport/${app.referenceNumber || app.id}`,
        documentReady: false,
      };
    }),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, RECENT_LIMIT);

  return (
    <div className="space-y-8">
      <ActionRequiredBanner items={actionItems} />
      <PassportActionRequiredBanner items={passportActionItems} />

      {submittedId ? (
        <div className="rounded-[24px] border border-ash bg-mint-wash/60 px-6 py-4">
          <SubmissionConfirmationTracker applicationId={submittedId} />
          <p className="font-switzer text-sm text-portrait-ink">
            Application submitted
            {submittedId.length > 8 ? ` (${submittedId.slice(0, 8)}…)` : ''}.
            We&apos;ll email you as it moves through review.
          </p>
        </div>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-switzer text-sm text-slate-helper">Dashboard</p>
          <h1 className="mt-1 font-basier text-[36px] leading-tight tracking-tight text-portrait-ink sm:text-[40px]">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1.5 max-w-xl font-switzer text-sm text-slate-helper sm:text-base">
            Finish drafts, track submissions, and start a new visa or passport
            application.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/">
            <Button variant="primary" size="md">
              Start a visa
            </Button>
          </Link>
          <Link href="/passport">
            <Button variant="ghost" size="md">
              Start a passport
            </Button>
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-ash">
          <CardHeader className="pb-2">
            <CardDescription>Applications</CardDescription>
            <CardTitle className="font-basier text-4xl text-portrait-ink">
              {totalApplications}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-switzer text-xs text-slate-helper">
              Submitted visa and passport files
            </p>
          </CardContent>
        </Card>
        <Card className="border-ash">
          <CardHeader className="pb-2">
            <CardDescription>In progress</CardDescription>
            <CardTitle className="font-basier text-4xl text-portrait-ink">
              {inProgress}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-switzer text-xs text-slate-helper">
              Drafts, review, or changes needed
            </p>
          </CardContent>
        </Card>
        <Card className="border-ash">
          <CardHeader className="pb-2">
            <CardDescription>Approved</CardDescription>
            <CardTitle className="font-basier text-4xl text-portrait-ink">
              {approved}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-switzer text-xs text-slate-helper">
              Ready for travel or completed
            </p>
          </CardContent>
        </Card>
      </section>

      <DraftApplicationsList
        drafts={drafts}
        flagUrls={flagUrls}
        title="Continue a draft"
        description={
          draftCount > DRAFT_LIMIT
            ? `Showing ${DRAFT_LIMIT} of ${draftCount} saved applications.`
            : 'Pick up an application you saved for later.'
        }
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-basier text-2xl text-portrait-ink">
              Recent applications
            </h2>
            <p className="mt-1 font-switzer text-sm text-slate-helper">
              Latest {RECENT_LIMIT} submitted files
            </p>
          </div>
          {totalApplications > 0 ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Link
                href="/applications/visa"
                className="font-switzer text-sm text-nautical-teal hover:text-portrait-ink"
              >
                All visas
              </Link>
              <Link
                href="/applications/passport"
                className="font-switzer text-sm text-nautical-teal hover:text-portrait-ink"
              >
                All passports
              </Link>
            </div>
          ) : null}
        </div>

        {recent.length === 0 ? (
          <Card className="border-ash">
            <CardContent className="py-14 text-center">
              <p className="font-switzer text-portrait-ink">
                No submitted applications yet
              </p>
              <p className="mt-2 font-switzer text-sm text-slate-helper">
                Start a visa destination or passport service to see it here.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link href="/">
                  <Button variant="primary" size="md">
                    Browse visas
                  </Button>
                </Link>
                <Link href="/passport">
                  <Button variant="ghost" size="md">
                    Passport services
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-ash bg-white">
            <div className="hidden border-b border-ash bg-[#fafbfc] px-4 py-2.5 sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(8rem,0.9fr)_6.5rem_auto] sm:gap-x-5">
              <p className="font-switzer text-[11px] font-semibold uppercase tracking-wider text-slate-helper">
                Application
              </p>
              <p className="font-switzer text-[11px] font-semibold uppercase tracking-wider text-slate-helper">
                Reference
              </p>
              <p className="font-switzer text-[11px] font-semibold uppercase tracking-wider text-slate-helper">
                Submitted
              </p>
              <p className="text-right font-switzer text-[11px] font-semibold uppercase tracking-wider text-slate-helper">
                Status
              </p>
            </div>
            <ul>
              {recent.map((item, index) => (
                <UserApplicationListItem
                  key={`${item.kind}-${item.id}`}
                  href={item.href}
                  title={item.title}
                  reference={item.reference}
                  dateLabel={item.dateLabel}
                  status={item.status}
                  travellerCount={item.travellerCount}
                  approvedTravellerCount={item.approvedTravellerCount}
                  countryCode={item.countryCode}
                  flagUrls={flagUrls}
                  showFlag={item.kind === 'visa'}
                  documentReady={item.documentReady}
                  isLast={index === recent.length - 1}
                />
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-basier text-2xl text-portrait-ink">
            Recent payments
          </h2>
          <p className="mt-1 font-switzer text-sm text-slate-helper">
            Last {PAYMENT_LIMIT} charges and refunds
          </p>
        </div>
        <PaymentHistory
          hideTitle
          payments={paymentRows.map((payment) => {
            const isVisa = payment.applicationType === 'visa';
            const isPassport = payment.applicationType === 'passport';
            const place = payment.visaCountry || payment.visaCountryCode;
            const visaLabel = place
              ? `${place}${payment.visaType ? ` · ${payment.visaType}` : ''}`
              : 'Visa payment';
            const passportLabel = payment.passportServiceType
              ? passportTitle(payment.passportServiceType)
              : 'Passport payment';
            const label = isVisa
              ? visaLabel
              : isPassport
                ? passportLabel
                : 'Payment';
            const ref = isVisa
              ? payment.visaReference
              : isPassport
                ? payment.passportReference
                : null;
            const href =
              payment.applicationId && (isVisa || isPassport)
                ? `/applications/${payment.applicationType}/${ref || payment.applicationId}?tab=payments`
                : null;

            return {
              id: payment.id,
              amount: payment.amount,
              currency: payment.currency,
              status: payment.status,
              paymentMethod: payment.paymentMethod,
              razorpayPaymentId: payment.razorpayPaymentId,
              razorpayOrderId: payment.razorpayOrderId,
              razorpayRefundId: payment.razorpayRefundId,
              kind: payment.kind,
              parentPaymentId: payment.parentPaymentId,
              createdAt: payment.createdAt,
              completedAt: payment.completedAt,
              label:
                payment.kind === 'refund'
                  ? label
                    ? `Refund · ${label}`
                    : 'Refund'
                  : label,
              href,
            };
          })}
        />
      </section>
    </div>
  );
}
