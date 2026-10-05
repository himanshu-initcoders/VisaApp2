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
import { TravellersSection } from '@/components/admin/TravellersSection';
import { TravellerSelectionProvider } from '@/components/admin/TravellerSelectionContext';
import { Timeline } from '@/components/admin/Timeline';
import { PaymentHistory } from '@/components/applications/PaymentHistory';
import { attachStatusToTravellers } from '@/lib/visa/caseStatus';
import type { ApplyFormConfig } from '@/lib/apply/applicationForm';
import { ApplicationSidebar } from '@/components/dashboard/ApplicationSidebar';

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

export default async function UserVisaApplicationDetailPage({
  params,
}: PageProps) {
  const session = await auth();
  if (!session) redirect('/signin');

  const { id } = await params;
  const details = await getApplicationDetails(id, 'visa');

  if (!details || details.user.id !== session.user.id) {
    notFound();
  }

  const app = details.application as {
    id: string;
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
          {app.country || app.countryCode || 'Visa'} — {app.visaType}
        </h1>
        <p className="mt-2 font-switzer text-lg text-slate-helper">
          Visa Application
          {details.formVersionNumber != null
            ? ` · Form v${details.formVersionNumber}`
            : ''}
        </p>
      </div>

      <TravellerSelectionProvider travellers={travellers}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
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
                        ? new Date(app.submittedAt).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                          })
                        : 'Not submitted'
                    }
                  />
                </dl>
              </CardContent>
            </Card>

            <PaymentHistory payments={details.payments} />

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
              <TravellersSection travellers={travellers} snapshot={snapshot} />
            )}

            {isLegacy && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
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
                    <CardTitle>Travel Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap font-switzer text-xs text-portrait-ink">
                      {JSON.stringify(app.travelInfo, null, 2) || '—'}
                    </pre>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <ApplicationSidebar
            documents={details.documents}
            statusHistory={details.statusHistory}
          />
        </div>
      </TravellerSelectionProvider>
    </div>
  );
}
