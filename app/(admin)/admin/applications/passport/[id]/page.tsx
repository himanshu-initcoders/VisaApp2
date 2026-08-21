import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import { getApplicationDetails } from '@/lib/admin-queries';
import { Card, CardHeader, CardTitle, CardContent, Badge, getStatusVariant } from '@/components/ui';
import { Timeline } from '@/components/admin/Timeline';
import { PassportApplicationActions } from './PassportApplicationActions';

/**
 * Passport Application Detail Page
 *
 * Full view of a passport service application with:
 * - Application information
 * - Personal and address information
 * - Service details
 * - Status management
 * - Document verification
 * - Internal notes
 */

interface PageProps {
  params: {
    id: string;
  };
}

export default async function PassportApplicationDetailPage({ params }: PageProps) {
  // Authorization check
  await requireRole(['admin', 'reviewer']);

  // Fetch application details
  const details = await getApplicationDetails(params.id, 'passport');

  if (!details) {
    notFound();
  }

  const app = details.application as any; // PassportService type
  const { personalInfo, addressInfo } = app;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/admin/applications"
        className="inline-flex items-center font-switzer text-sm text-nautical-teal hover:text-portrait-ink transition-colors"
      >
        <svg
          className="w-4 h-4 mr-1"
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
        Back to Applications
      </Link>

      {/* Page Header */}
      <div>
        <h1 className="font-basier text-[44px] text-portrait-ink leading-tight">
          Passport {app.serviceType}
        </h1>
        <p className="font-switzer text-lg text-slate-helper mt-2">
          Passport Service Application
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Application Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Application Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Application Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-switzer text-xs text-slate-helper mb-1">
                    Status
                  </p>
                  <Badge variant={getStatusVariant(app.status)}>
                    {app.status}
                  </Badge>
                </div>
                <div>
                  <p className="font-switzer text-xs text-slate-helper mb-1">
                    Application ID
                  </p>
                  <p className="font-switzer text-sm font-mono text-portrait-ink">
                    {app.id.slice(0, 8)}
                  </p>
                </div>
                <div>
                  <p className="font-switzer text-xs text-slate-helper mb-1">
                    Service Type
                  </p>
                  <p className="font-switzer text-sm text-portrait-ink">
                    {app.serviceType}
                  </p>
                </div>
                <div>
                  <p className="font-switzer text-xs text-slate-helper mb-1">
                    Submitted
                  </p>
                  <p className="font-switzer text-sm text-portrait-ink">
                    {app.submittedAt
                      ? new Date(app.submittedAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'Not submitted'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="font-switzer text-xs text-slate-helper mb-1">
                    Full Name
                  </dt>
                  <dd className="font-switzer text-sm text-portrait-ink">
                    {personalInfo?.fullName || details.user.name}
                  </dd>
                </div>
                <div>
                  <dt className="font-switzer text-xs text-slate-helper mb-1">
                    Email
                  </dt>
                  <dd className="font-switzer text-sm text-portrait-ink">
                    {details.user.email}
                  </dd>
                </div>
                <div>
                  <dt className="font-switzer text-xs text-slate-helper mb-1">
                    Phone
                  </dt>
                  <dd className="font-switzer text-sm text-portrait-ink">
                    {details.user.phone || 'Not provided'}
                  </dd>
                </div>
                <div>
                  <dt className="font-switzer text-xs text-slate-helper mb-1">
                    Date of Birth
                  </dt>
                  <dd className="font-switzer text-sm text-portrait-ink">
                    {personalInfo?.dateOfBirth || 'Not provided'}
                  </dd>
                </div>
                <div>
                  <dt className="font-switzer text-xs text-slate-helper mb-1">
                    Citizenship
                  </dt>
                  <dd className="font-switzer text-sm text-portrait-ink">
                    {personalInfo?.citizenship || 'Not provided'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card>
            <CardHeader>
              <CardTitle>Address Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <dt className="font-switzer text-xs text-slate-helper mb-1">
                  Current Address
                </dt>
                <dd className="font-switzer text-sm text-portrait-ink">
                  {addressInfo?.currentAddress || 'Not provided'}
                </dd>
              </div>
              <div>
                <dt className="font-switzer text-xs text-slate-helper mb-1">
                  Permanent Address
                </dt>
                <dd className="font-switzer text-sm text-portrait-ink">
                  {addressInfo?.permanentAddress || 'Not provided'}
                </dd>
              </div>
            </CardContent>
          </Card>

          {/* Service Details */}
          <Card>
            <CardHeader>
              <CardTitle>Service Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <dt className="font-switzer text-xs text-slate-helper mb-1">
                    Appointment Date
                  </dt>
                  <dd className="font-switzer text-sm text-portrait-ink">
                    {app.appointmentDate
                      ? new Date(app.appointmentDate).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'Not scheduled'}
                  </dd>
                </div>
                <div>
                  <dt className="font-switzer text-xs text-slate-helper mb-1">
                    Appointment Location
                  </dt>
                  <dd className="font-switzer text-sm text-portrait-ink">
                    {app.appointmentLocation || 'Not specified'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Right column - Actions and Status */}
        <div className="space-y-6">
          {/* Status Management - Client Component */}
          <PassportApplicationActions
            applicationId={app.id}
            currentStatus={app.status}
            documents={details.documents}
            statusHistory={details.statusHistory}
          />
        </div>
      </div>
    </div>
  );
}
