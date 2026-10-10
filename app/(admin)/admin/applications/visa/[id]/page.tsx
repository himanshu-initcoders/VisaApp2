import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { ExternalLink } from 'lucide-react';
import { requireRole } from '@/lib/auth-utils';
import { getApplicationDetails } from '@/lib/admin-queries';
import { db } from '@/lib/db';
import { visaListings } from '@/lib/db/schema-extended';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  getStatusVariant,
  Tabs,
  TabsPanel,
} from '@/components/ui';
import { VisaApplicationActions } from './VisaApplicationActions';
import { AssignReviewerCard } from '@/components/admin/AssignReviewerDialog';
import { CallLogsPanel } from '@/components/admin/CallLogsPanel';
import { NotesPanel } from '@/components/admin/NotesPanel';
import { CorrectionsCard } from '@/components/admin/CorrectionsCard';
import { ConversationThread } from '@/components/visa/ConversationThread';
import { TravellersSection } from '@/components/admin/TravellersSection';
import { TravellerSelectionProvider } from '@/components/admin/TravellerSelectionContext';
import { Timeline } from '@/components/admin/Timeline';
import { PaymentHistory } from '@/components/applications/PaymentHistory';
import { attachStatusToTravellers } from '@/lib/visa/caseStatus';
import type { ApplyFormConfig } from '@/lib/apply/applicationForm';
import { postStaffComment } from '@/app/(admin)/actions';
import {
  buildCorrectableTargets,
  listComments,
  listCorrectionRounds,
} from '@/lib/visa/corrections';
import { markApplicationNotificationsRead } from '@/lib/notifications';

interface PageProps {
  params: Promise<{ id: string }>;
}

type StoredTraveller = {
  passengerId?: string;
  name?: string;
  passportData?: Record<string, unknown> | null;
  tripDetails?: Record<string, unknown> | null;
  documents?: Array<{
    slotKey?: string;
    key?: string;
    url?: string;
    mimeType?: string;
    filename?: string;
  }>;
};

const DETAIL_TABS = [
  { id: 'application', label: 'Application information' },
  { id: 'payments', label: 'Payments' },
  { id: 'call-logs', label: 'Call logs' },
  { id: 'notes', label: 'Notes' },
  { id: 'corrections', label: 'Corrections' },
  { id: 'conversation', label: 'Conversation' },
] as const;

function officialApplyUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="mb-1 font-switzer text-xs text-slate-helper">{label}</dt>
      <dd className="break-words font-switzer text-sm text-portrait-ink">
        {value || '—'}
      </dd>
    </div>
  );
}

export default async function VisaApplicationDetailPage({ params }: PageProps) {
  const session = await requireRole(['admin', 'reviewer']);

  const { id } = await params;
  const details = await getApplicationDetails(id, 'visa');

  if (!details) {
    notFound();
  }

  if (
    session.user.role === 'reviewer' &&
    details.assignedReviewer?.id !== session.user.id
  ) {
    notFound();
  }

  const app = details.application as {
    id: string;
    visaListingId?: string | null;
    country?: string | null;
    countryCode?: string | null;
    visaType?: string;
    status: string;
    submittedAt?: Date | null;
    createdAt: Date;
    applicantName?: string | null;
    applicantPhone?: string | null;
    travellers?: StoredTraveller[] | null;
    formSnapshot?: ApplyFormConfig | null;
    personalInfo?: Record<string, unknown> | null;
    travelInfo?: Record<string, unknown> | null;
    employmentInfo?: Record<string, unknown> | null;
  };

  const snapshot = (app.formSnapshot as ApplyFormConfig | null) ?? null;
  const storedTravellers: StoredTraveller[] = Array.isArray(app.travellers)
    ? app.travellers
    : [];
  const travellers = attachStatusToTravellers(
    storedTravellers,
    details.travellers
  );
  const isLegacy = storedTravellers.length === 0;
  const fileHistory =
    travellers.length > 1
      ? details.statusHistory.filter((item) => item.travellerId == null)
      : [];
  const applicantPhone = app.applicantPhone || details.user.phone;
  const [comments, rounds, listingRows] = await Promise.all([
    listComments(app.id),
    listCorrectionRounds(app.id, snapshot),
    app.visaListingId
      ? db
          .select({ sourceUrl: visaListings.sourceUrl })
          .from(visaListings)
          .where(eq(visaListings.id, app.visaListingId))
          .limit(1)
      : Promise.resolve([]),
  ]);
  const applyFormUrl = officialApplyUrl(listingRows[0]?.sourceUrl);
  await markApplicationNotificationsRead(session.user.id, app.id);
  const correctionTravellers = travellers.flatMap((traveller) =>
    traveller.travellerRowId
      ? [
          {
            id: traveller.travellerRowId,
            name: traveller.name?.trim() || 'Traveller',
          },
        ]
      : []
  );

  return (
    <div className="space-y-6">
      <Link
        href="/admin/applications"
        className="inline-flex items-center font-switzer text-sm text-nautical-teal transition-colors hover:text-portrait-ink"
      >
        ← Back to Applications
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-basier text-[44px] leading-tight text-portrait-ink">
            {app.country || app.countryCode || 'Visa'} — {app.visaType}
          </h1>
          <p className="mt-2 font-switzer text-lg text-slate-helper">
            Visa Application
            {details.formVersionNumber != null
              ? ` · Form v${details.formVersionNumber}`
              : ''}
          </p>
        </div>
        {applyFormUrl ? (
          <a
            href={applyFormUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 pt-2 font-switzer text-sm font-semibold text-nautical-teal hover:text-portrait-ink"
          >
            Apply form here
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        ) : null}
      </div>

      <TravellerSelectionProvider travellers={travellers}>
        <CorrectionsCard
          rounds={rounds.filter((round) => round.status !== 'resolved')}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Tabs
              items={[...DETAIL_TABS]}
              defaultValue="application"
              tone="light"
              layoutId={`visa-app-detail-tabs-${app.id}`}
              ariaLabel="Application detail sections"
            >
              <TabsPanel id="application">
                <Card>
                  <CardHeader>
                    <CardTitle>Application information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-4">
                      <Field
                        label="Status"
                        value={
                          <Badge variant={getStatusVariant(app.status)}>
                            {app.status}
                          </Badge>
                        }
                      />
                      <Field label="Application ID" value={app.id} />
                      <Field
                        label="Applicant"
                        value={app.applicantName || details.user.name}
                      />
                      <Field
                        label="Phone"
                        value={applicantPhone || 'Not provided'}
                      />
                      <Field
                        label="Country"
                        value={app.country || app.countryCode}
                      />
                      <Field
                        label="Submitted"
                        value={
                          app.submittedAt
                            ? new Date(app.submittedAt).toLocaleString(
                                'en-IN',
                                {
                                  timeZone: 'Asia/Kolkata',
                                }
                              )
                            : 'Not submitted'
                        }
                      />
                    </dl>
                  </CardContent>
                </Card>

                {fileHistory.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>File history</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-4 font-switzer text-sm text-slate-helper">
                        These updates were recorded for the whole application,
                        before each traveller had a separate visa status.
                      </p>
                      <Timeline history={fileHistory} />
                    </CardContent>
                  </Card>
                )}

                {!isLegacy && (
                  <TravellersSection
                    travellers={travellers}
                    snapshot={snapshot}
                  />
                )}

                {isLegacy && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>Personal Information (legacy)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Field label="Full Name" value={details.user.name} />
                          <Field label="Email" value={details.user.email} />
                          <Field
                            label="Phone"
                            value={details.user.phone || 'Not provided'}
                          />
                          <Field
                            label="Passport Number"
                            value={
                              (app.personalInfo?.passportNumber as string) ||
                              'Not provided'
                            }
                          />
                        </dl>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Travel Information (legacy)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="whitespace-pre-wrap font-switzer text-xs text-portrait-ink">
                          {JSON.stringify(app.travelInfo, null, 2) || '—'}
                        </pre>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsPanel>

              <TabsPanel id="payments">
                <PaymentHistory payments={details.payments} />
              </TabsPanel>

              <TabsPanel id="call-logs">
                <CallLogsPanel
                  applicationId={app.id}
                  logs={details.callLogs}
                  defaultPhone={applicantPhone}
                  hideTitle
                />
              </TabsPanel>

              <TabsPanel id="notes">
                <NotesPanel
                  applicationId={app.id}
                  notes={details.notes}
                  hideTitle
                />
              </TabsPanel>
              <TabsPanel id="corrections">
                {rounds.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="font-switzer text-sm text-slate-helper">
                        No correction requests yet.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <CorrectionsCard rounds={rounds} />
                )}
              </TabsPanel>
              <TabsPanel id="conversation">
                <ConversationThread
                  applicationId={app.id}
                  comments={comments}
                  postComment={postStaffComment}
                />
              </TabsPanel>
            </Tabs>
          </div>

          <div className="space-y-6">
            <AssignReviewerCard
              applicationId={app.id}
              assignedReviewerId={details.assignedReviewer?.id ?? null}
              assignedReviewerName={details.assignedReviewer?.name ?? null}
              canAssign={session.user.role === 'admin'}
            />
            <VisaApplicationActions
              applicationId={app.id}
              currentStatus={app.status}
              documents={details.documents}
              statusHistory={details.statusHistory}
              travellers={correctionTravellers}
              correctionTargets={buildCorrectableTargets(snapshot)}
            />
          </div>
        </div>
      </TravellerSelectionProvider>
    </div>
  );
}
