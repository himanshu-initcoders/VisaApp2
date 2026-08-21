import Link from 'next/link';
import { Badge, getStatusVariant, Card } from '@/components/ui';
import type { ApplicationListItem } from '@/types/admin';

/**
 * Applications Table Component
 *
 * Table displaying all applications with:
 * - Columns: Application ID, User, Type, Country/Service, Status, Date, Actions
 * - Sortable columns
 * - Hover effects
 * - "View Details" link
 */

export interface ApplicationsTableProps {
  applications: ApplicationListItem[];
}

export function ApplicationsTable({ applications }: ApplicationsTableProps) {
  if (applications.length === 0) {
    return (
      <Card className="py-12">
        <div className="text-center">
          <svg
            className="w-12 h-12 mx-auto text-slate-helper mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="font-switzer text-sm text-slate-helper">
            No applications found
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-ash bg-[#fafbfc]">
              <th className="px-6 py-4 text-left font-switzer text-xs font-semibold text-slate-helper uppercase tracking-wider">
                Application ID
              </th>
              <th className="px-6 py-4 text-left font-switzer text-xs font-semibold text-slate-helper uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-4 text-left font-switzer text-xs font-semibold text-slate-helper uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-4 text-left font-switzer text-xs font-semibold text-slate-helper uppercase tracking-wider">
                Details
              </th>
              <th className="px-6 py-4 text-left font-switzer text-xs font-semibold text-slate-helper uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left font-switzer text-xs font-semibold text-slate-helper uppercase tracking-wider">
                Submitted
              </th>
              <th className="px-6 py-4 text-left font-switzer text-xs font-semibold text-slate-helper uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <tr
                key={`${app.type}-${app.id}`}
                className="border-b border-ash hover:bg-sky-wash/10 transition-colors"
              >
                {/* Application ID (shortened) */}
                <td className="px-6 py-4">
                  <span className="font-switzer text-sm font-mono text-portrait-ink">
                    {app.id.slice(0, 8)}
                  </span>
                </td>

                {/* User */}
                <td className="px-6 py-4">
                  <div>
                    <p className="font-switzer text-sm font-medium text-portrait-ink">
                      {app.userName}
                    </p>
                    <p className="font-switzer text-xs text-slate-helper">
                      {app.userEmail}
                    </p>
                  </div>
                </td>

                {/* Type */}
                <td className="px-6 py-4">
                  <span className="font-switzer text-sm text-portrait-ink capitalize">
                    {app.type}
                  </span>
                </td>

                {/* Details (country/visa type or passport service type) */}
                <td className="px-6 py-4">
                  {app.type === 'visa' ? (
                    <div>
                      <p className="font-switzer text-sm text-portrait-ink">
                        {app.country}
                      </p>
                      <p className="font-switzer text-xs text-slate-helper">
                        {app.visaType}
                      </p>
                    </div>
                  ) : (
                    <p className="font-switzer text-sm text-portrait-ink">
                      {app.serviceType}
                    </p>
                  )}
                </td>

                {/* Status */}
                <td className="px-6 py-4">
                  <Badge variant={getStatusVariant(app.status)}>
                    {app.status}
                  </Badge>
                </td>

                {/* Submitted date */}
                <td className="px-6 py-4">
                  <span className="font-switzer text-sm text-slate-helper">
                    {app.submittedAt
                      ? new Date(app.submittedAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Not submitted'}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-6 py-4">
                  <Link
                    href={`/admin/applications/${app.type}/${app.id}`}
                    className="font-switzer text-sm text-nautical-teal hover:text-portrait-ink font-medium transition-colors"
                  >
                    View Details →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
