import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getApplicationDetails } from '@/lib/admin-queries';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  getStatusVariant,
} from '@/components/ui';
import { ApplicationSidebar } from '@/components/dashboard/ApplicationSidebar';
import { ApplicantActivityTabs } from '@/components/dashboard/ApplicantActivityTabs';
import { PassportActionRequiredBanner } from '@/components/dashboard/PassportActionRequiredBanner';
import {
  PassportFormAnswers,
  buildPassportDocumentLabelMap,
} from '@/components/passport/PassportFormAnswers';
import type { PassportApplyFormConfig } from '@/lib/apply/passportForm';
import { postApplicantComment } from '@/app/(dashboard)/actions';
import { listPassportApplicantActionItems } from '@/lib/passport/corrections';
import { listComments } from '@/lib/visa/corrections';
import { hasUnreadStaffComment } from '@/lib/notifications';

interface PageProps {
  params: Promise<{ id: string }>;
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

export default async function UserPassportApplicationDetailPage({
  params,
}: PageProps) {
  const session = await auth();
  if (!session) redirect('/signin');

  const { id } = await params;
  const details = await getApplicationDetails(id, 'passport');

  if (!details || details.user.id !== session.user.id) {
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
  const [comments, actionItems, hasUnreadConversation] = await Promise.all([
    listComments(app.id),
    listPassportApplicantActionItems(session.user.id),
    hasUnreadStaffComment(session.user.id, app.id),
  ]);
  const openForThis = actionItems.filter(
    (item) => item.applicationId === app.id
  );

  return (
    <div className="space-y-6">
      <Link
        href="/applications"
        className="inline-flex items-center font-switzer text-sm text-nautical-teal transition-colors hover:text-portrait-ink"
      >
        ← Back to Applications
      </Link>

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

      <PassportActionRequiredBanner items={openForThis} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ApplicantActivityTabs
            applicationId={app.id}
            hasUnreadConversation={hasUnreadConversation}
            comments={comments}
            payments={details.payments}
            postComment={postApplicantComment}
          >
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

            <div className="mt-6">
              <PassportFormAnswers snapshot={snapshot} answers={app.answers} />
            </div>
          </ApplicantActivityTabs>
        </div>

        <ApplicationSidebar
          documents={details.documents}
          statusHistory={details.statusHistory}
          documentLabels={documentLabels}
        />
      </div>
    </div>
  );
}
