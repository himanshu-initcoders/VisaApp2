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
    serviceType: string;
    status: string;
    submittedAt?: Date | null;
    appointmentDate?: Date | null;
    appointmentLocation?: string | null;
    personalInfo?: Record<string, string> | null;
    addressInfo?: Record<string, string> | null;
  };

  const { personalInfo, addressInfo } = app;

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
                <Field label="Application ID" value={app.id} />
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

          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Full Name"
                  value={personalInfo?.fullName || details.user.name}
                />
                <Field label="Email" value={details.user.email} />
                <Field
                  label="Phone"
                  value={details.user.phone || 'Not provided'}
                />
                <Field
                  label="Date of Birth"
                  value={personalInfo?.dateOfBirth || 'Not provided'}
                />
                <Field
                  label="Citizenship"
                  value={personalInfo?.citizenship || 'Not provided'}
                />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Address Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Current Address"
                value={addressInfo?.currentAddress || 'Not provided'}
              />
              <Field
                label="Permanent Address"
                value={addressInfo?.permanentAddress || 'Not provided'}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Appointment Date"
                  value={
                    app.appointmentDate
                      ? new Date(app.appointmentDate).toLocaleDateString(
                          'en-IN',
                          {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            timeZone: 'Asia/Kolkata',
                          }
                        )
                      : 'Not scheduled'
                  }
                />
                <Field
                  label="Appointment Location"
                  value={app.appointmentLocation || 'Not specified'}
                />
              </dl>
            </CardContent>
          </Card>
        </div>

        <ApplicationSidebar
          documents={details.documents}
          statusHistory={details.statusHistory}
        />
      </div>
    </div>
  );
}
