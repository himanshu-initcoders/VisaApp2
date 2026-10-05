import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth-utils';
import {
  getAdminUserById,
  getApplicationsForUser,
  getUserPassengerDocuments,
  getVisaApplicationsAssignedToReviewer,
  getReviewerActivity,
} from '@/lib/admin-queries';
import { Badge, getRoleVariant, Card, CardContent, Tabs, TabsPanel } from '@/components/ui';
import { ApplicationLinkTable } from './ApplicationLinkTable';
import { UserDocumentsPanel } from './UserDocumentsPanel';
import { ReviewerActivityFeed } from './ReviewerActivityFeed';
import { DeactivateUserButton } from './DeactivateUserButton';

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatRegistered(value: Date): string {
  return new Date(value).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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

async function ApplicantTabs({ userId }: { userId: string }) {
  const [applications, passengerDocuments] = await Promise.all([
    getApplicationsForUser(userId),
    getUserPassengerDocuments(userId),
  ]);

  return (
    <Tabs
      items={[
        { id: 'applications', label: 'Applications' },
        { id: 'documents', label: 'Documents' },
      ]}
      defaultValue="applications"
      tone="light"
      layoutId={`admin-user-applicant-${userId}`}
      ariaLabel="Applicant sections"
    >
      <TabsPanel id="applications">
        <ApplicationLinkTable
          applications={applications}
          emptyMessage="No applications yet"
        />
      </TabsPanel>
      <TabsPanel id="documents">
        <UserDocumentsPanel
          passengers={passengerDocuments.passengers}
          otherDocuments={passengerDocuments.otherDocuments}
        />
      </TabsPanel>
    </Tabs>
  );
}

async function ReviewerTabs({ userId }: { userId: string }) {
  const [applications, activity] = await Promise.all([
    getVisaApplicationsAssignedToReviewer(userId),
    getReviewerActivity(userId),
  ]);

  return (
    <Tabs
      items={[
        { id: 'assigned', label: 'Assigned visas' },
        { id: 'activity', label: 'Activity' },
      ]}
      defaultValue="assigned"
      tone="light"
      layoutId={`admin-user-reviewer-${userId}`}
      ariaLabel="Reviewer sections"
    >
      <TabsPanel id="assigned">
        <ApplicationLinkTable
          applications={applications}
          emptyMessage="No visa applications assigned"
        />
      </TabsPanel>
      <TabsPanel id="activity">
        <ReviewerActivityFeed items={activity} />
      </TabsPanel>
    </Tabs>
  );
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  await requireRole(['admin']);

  const { id } = await params;
  const user = await getAdminUserById(id);

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center font-switzer text-sm text-nautical-teal transition-colors hover:text-portrait-ink"
      >
        ← Back to Users
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-basier text-[44px] leading-tight text-portrait-ink">
            {user.name}
          </h1>
          <Badge variant={getRoleVariant(user.role)}>{user.role}</Badge>
          {user.deactivatedAt ? (
            <Badge variant="rejected">Deactivated</Badge>
          ) : null}
          {user.role !== 'admin' ? (
            <DeactivateUserButton
              userId={user.id}
              deactivated={Boolean(user.deactivatedAt)}
            />
          ) : null}
        </div>
        <p className="mt-2 font-switzer text-lg text-slate-helper">
          {user.email}
        </p>
      </div>

      <Card>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone" value={user.phone || 'Not provided'} />
            <Field label="Registered" value={formatRegistered(user.createdAt)} />
          </dl>
        </CardContent>
      </Card>

      {user.role === 'user' ? <ApplicantTabs userId={user.id} /> : null}
      {user.role === 'reviewer' ? <ReviewerTabs userId={user.id} /> : null}
    </div>
  );
}
