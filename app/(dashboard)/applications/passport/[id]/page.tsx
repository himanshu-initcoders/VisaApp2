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
import {
  PassportFormAnswers,
  buildPassportDocumentLabelMap,
} from '@/components/passport/PassportFormAnswers';
import type { PassportApplyFormConfig } from '@/lib/apply/passportForm';

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
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
                  value={app.referenceNumber || app.id}
                />
                <Field label="Service Type" value={app.serviceType} />
                <Field
                  label="Submitted"
                  value={
                    app.submittedAt
                      ? new Date(app.submittedAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          timeZone: 'Asia/Kolkata',
                        })
                      : 'Not submitted'
                  }
                />
              </dl>
            </CardContent>
          </Card>

          <PassportFormAnswers snapshot={snapshot} answers={app.answers} />
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
