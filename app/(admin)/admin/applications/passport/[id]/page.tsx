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
} from '@/components/ui';
import { PassportApplicationActions } from './PassportApplicationActions';
import { PortalCredentialsPanel } from '@/components/admin/PortalCredentialsPanel';
import {
  PassportFormAnswers,
  buildPassportDocumentLabelMap,
} from '@/components/passport/PassportFormAnswers';
import type { PassportApplyFormConfig } from '@/lib/apply/passportForm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PassportApplicationDetailPage({
  params,
}: PageProps) {
  const session = await requireRole(['admin', 'reviewer']);
  if (session.user.role === 'reviewer') {
    notFound();
  }

  const { id } = await params;
  const details = await getApplicationDetails(id, 'passport');

  if (!details) {
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

  return (
    <div className="space-y-6">
      <Link
        href="/admin/applications/passport"
        className="inline-flex items-center font-switzer text-sm text-nautical-teal transition-colors hover:text-portrait-ink"
      >
        <svg
          className="mr-1 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Passport applications
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Application Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1 font-switzer text-xs text-slate-helper">
                    Status
                  </p>
                  <Badge variant={getStatusVariant(app.status)}>
                    {app.status}
                  </Badge>
                </div>
                <div>
                  <p className="mb-1 font-switzer text-xs text-slate-helper">
                    Reference
                  </p>
                  <p className="font-switzer text-sm font-mono text-portrait-ink">
                    {app.referenceNumber || app.id.slice(0, 8)}
                  </p>
                </div>
                <div>
                  <p className="mb-1 font-switzer text-xs text-slate-helper">
                    Service Type
                  </p>
                  <p className="font-switzer text-sm text-portrait-ink">
                    {app.serviceType}
                  </p>
                </div>
                <div>
                  <p className="mb-1 font-switzer text-xs text-slate-helper">
                    Submitted
                  </p>
                  <p className="font-switzer text-sm text-portrait-ink">
                    {app.submittedAt
                      ? new Date(app.submittedAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          timeZone: 'Asia/Kolkata',
                        })
                      : 'Not submitted'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <PassportFormAnswers snapshot={snapshot} answers={app.answers} />
        </div>

        <div className="space-y-6">
          <PassportApplicationActions
            applicationId={app.id}
            currentStatus={app.status}
            documents={details.documents}
            statusHistory={details.statusHistory}
            documentLabels={documentLabels}
          />
        </div>
      </div>
    </div>
  );
}
