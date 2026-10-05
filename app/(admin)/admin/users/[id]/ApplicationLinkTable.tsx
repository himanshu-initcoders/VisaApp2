import { Card } from '@/components/ui';
import { ApplicationStatusCell } from '@/components/shared/ApplicationStatusCell';
import { DetailArrowLink } from '@/components/admin/DetailArrowLink';
import type { UserApplicationSummary } from '@/types/admin';

function formatSubmitted(value: Date | null): string {
  if (!value) return 'Not submitted';
  return new Date(value).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function ApplicationLinkTable({
  applications,
  emptyMessage,
}: {
  applications: UserApplicationSummary[];
  emptyMessage: string;
}) {
  if (applications.length === 0) {
    return (
      <Card className="py-12">
        <p className="text-center font-switzer text-sm text-slate-helper">
          {emptyMessage}
        </p>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ash bg-[#fafbfc]">
              <th className="px-6 py-4 text-left font-switzer text-xs font-semibold uppercase tracking-wider text-slate-helper">
                Application
              </th>
              <th className="px-6 py-4 text-left font-switzer text-xs font-semibold uppercase tracking-wider text-slate-helper">
                Type
              </th>
              <th className="px-6 py-4 text-left font-switzer text-xs font-semibold uppercase tracking-wider text-slate-helper">
                Status
              </th>
              <th className="px-6 py-4 text-left font-switzer text-xs font-semibold uppercase tracking-wider text-slate-helper">
                Submitted
              </th>
              <th className="px-6 py-4 text-left font-switzer text-xs font-semibold uppercase tracking-wider text-slate-helper">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => (
              <tr
                key={`${application.type}-${application.id}`}
                className="border-b border-ash transition-colors hover:bg-sky-wash/10"
              >
                <td className="px-6 py-4">
                  <p className="font-switzer text-sm font-medium text-portrait-ink">
                    {application.title}
                  </p>
                  <p className="font-switzer text-xs text-slate-helper">
                    {application.detail}
                  </p>
                </td>
                <td className="px-6 py-4">
                  <span className="font-switzer text-sm capitalize text-portrait-ink">
                    {application.type}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <ApplicationStatusCell
                    status={application.status}
                    travellerCount={application.travellerCount}
                    approvedTravellerCount={application.approvedTravellerCount}
                  />
                </td>
                <td className="px-6 py-4">
                  <span className="font-switzer text-sm text-slate-helper">
                    {formatSubmitted(application.submittedAt)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <DetailArrowLink
                    href={`/admin/applications/${application.type}/${application.id}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
