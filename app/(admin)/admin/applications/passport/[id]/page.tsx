import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import { getApplicationDetails } from '@/lib/admin-queries';
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
import { PassportApplicationActions } from './PassportApplicationActions';
import { AssignReviewerCard } from '@/components/admin/AssignReviewerDialog';
import { CallLogsPanel } from '@/components/admin/CallLogsPanel';
import { NotesPanel } from '@/components/admin/NotesPanel';
import { PortalCredentialsPanel } from '@/components/admin/PortalCredentialsPanel';
import { CorrectionsCard } from '@/components/admin/CorrectionsCard';
import { StaffEditsCard } from '@/components/admin/StaffEditsCard';
import { ConversationThread } from '@/components/visa/ConversationThread';
import { PaymentHistory } from '@/components/applications/PaymentHistory';
import {
  PassportFormAnswers,
  buildPassportDocumentLabelMap,
} from '@/components/passport/PassportFormAnswers';
import type { PassportApplyFormConfig } from '@/lib/apply/passportForm';
import { postStaffComment } from '@/app/(admin)/actions';
import {
  buildPassportCorrectableTargets,
  listPassportCorrectionRounds,
  listPassportStaffFieldEdits,
} from '@/lib/passport/corrections';
import { listComments } from '@/lib/visa/corrections';
import { markApplicationNotificationsRead } from '@/lib/notifications';

interface PageProps {
  params: Promise<{ id: string }>;
}

const DETAIL_TABS = [
  { id: 'application', label: 'Application information' },
  { id: 'payments', label: 'Payments' },
  { id: 'call-logs', label: 'Call logs' },
  { id: 'notes', label: 'Notes' },
  { id: 'corrections', label: 'Corrections' },
  { id: 'conversation', label: 'Conversation' },
] as const;

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

export default async function PassportApplicationDetailPage({
  params,
}: PageProps) {
  const session = await requireRole(['admin', 'reviewer']);

  const { id } = await params;
  const details = await getApplicationDetails(id, 'passport');

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
    referenceNumber?: string | null;
    serviceType: string;
    status: string;
    submittedAt?: Date | null;
    formSnapshot?: PassportApplyFormConfig | null;
    answers?: Record<string, unknown> | null;
  };

  const snapshot = (app.formSnapshot as PassportApplyFormConfig | null) ?? null;
  const documentLabels = buildPassportDocumentLabelMap(snapshot);
  const correctionTargets = buildPassportCorrectableTargets(snapshot);
  const [comments, rounds, staffEdits] = await Promise.all([
    listComments(app.id),
    listPassportCorrectionRounds(app.id, snapshot),
    listPassportStaffFieldEdits(app.id, snapshot),
  ]);
  await markApplicationNotificationsRead(session.user.id, app.id);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/applications/passport"
        className="inline-flex items-center font-switzer text-sm text-nautical-teal transition-colors hover:text-portrait-ink"
      >
        ← Back to Passport applications
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-basier text-[44px] leading-tight text-portrait-ink">
            Passport {app.serviceType}
          </h1>
          <p className="mt-2 font-switzer text-lg text-slate-helper">
            Passport Service Application
            {details.formVersionNumber != null
              ? ` · Form v${details.formVersionNumber}`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <PortalCredentialsPanel
            applicationId={app.id}
            applicationType="passport"
            username={details.portalCredential.username}
            hasCredential={details.portalCredential.hasCredential}
          />
        </div>
      </div>

      <CorrectionsCard
        rounds={rounds.filter((round) => round.status !== 'resolved')}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs
            items={[...DETAIL_TABS]}
            defaultValue="application"
            tone="light"
            layoutId={`passport-app-detail-tabs-${app.id}`}
            ariaLabel="Application detail sections"
          >
            <TabsPanel id="application">
              <Card>
                <CardHeader>
                  <CardTitle>Application Information</CardTitle>
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
                    <Field
                      label="Reference"
                      value={app.referenceNumber || app.id.slice(0, 8)}
                    />
                    <Field label="Applicant" value={details.user.name} />
                    <Field
                      label="Phone"
                      value={details.user.phone || 'Not provided'}
                    />
                    <Field label="Service type" value={app.serviceType} />
                    <Field
                      label="Submitted"
                      value={
                        app.submittedAt
                          ? new Date(app.submittedAt).toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                            })
                          : 'Not submitted'
                      }
                    />
                  </dl>
                </CardContent>
              </Card>

              <div className="mt-6 space-y-6">
                <PassportFormAnswers snapshot={snapshot} answers={app.answers} />
              </div>
            </TabsPanel>

            <TabsPanel id="payments">
              <PaymentHistory
                payments={details.payments}
                canRefund
                applicationId={app.id}
                applicationType="passport"
                hideTitle
              />
            </TabsPanel>

            <TabsPanel id="call-logs">
              <CallLogsPanel
                applicationId={app.id}
                applicationType="passport"
                logs={details.callLogs}
                defaultPhone={details.user.phone}
                hideTitle
              />
            </TabsPanel>

            <TabsPanel id="notes">
              <NotesPanel
                applicationId={app.id}
                applicationType="passport"
                notes={details.notes}
                hideTitle
              />
            </TabsPanel>

            <TabsPanel id="corrections">
              {rounds.length === 0 && staffEdits.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="font-switzer text-sm text-slate-helper">
                      No correction requests yet.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  <StaffEditsCard edits={staffEdits} />
                  <CorrectionsCard rounds={rounds} />
                </div>
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
            applicationType="passport"
            assignedReviewerId={details.assignedReviewer?.id ?? null}
            assignedReviewerName={details.assignedReviewer?.name ?? null}
            canAssign={session.user.role === 'admin'}
          />
          <PassportApplicationActions
            applicationId={app.id}
            currentStatus={app.status}
            documents={details.documents}
            statusHistory={details.statusHistory}
            documentLabels={documentLabels}
            correctionTargets={correctionTargets}
          />
        </div>
      </div>
    </div>
  );
}
