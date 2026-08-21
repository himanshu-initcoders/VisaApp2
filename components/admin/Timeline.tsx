import { Badge, getStatusVariant } from '@/components/ui';
import type { StatusHistoryItem } from '@/types/admin';

/**
 * Timeline Component
 *
 * Vertical timeline for displaying application status history
 * Shows: Status change, Changed by (admin name), Timestamp, Notes
 */

export interface TimelineProps {
  history: StatusHistoryItem[];
}

export function Timeline({ history }: TimelineProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="font-switzer text-sm text-slate-helper">
          No status history yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((item, index) => {
        const isStatusChange = item.oldStatus !== item.newStatus;

        return (
          <div key={item.id} className="relative pl-6">
            {/* Timeline line */}
            {index !== history.length - 1 && (
              <div className="absolute left-[7px] top-6 bottom-0 w-0.5 bg-nautical-teal/30" />
            )}

            {/* Timeline dot */}
            <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-nautical-teal border-2 border-white" />

            {/* Content */}
            <div className="pb-4">
              <div className="flex items-center gap-2 mb-1">
                {isStatusChange ? (
                  <>
                    <Badge variant={getStatusVariant(item.oldStatus || '')}>
                      {item.oldStatus}
                    </Badge>
                    <svg
                      className="w-4 h-4 text-slate-helper"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                    <Badge variant={getStatusVariant(item.newStatus)}>
                      {item.newStatus}
                    </Badge>
                  </>
                ) : (
                  <span className="font-switzer text-sm font-medium text-portrait-ink">
                    Note Added
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-helper font-switzer mb-1">
                <span>
                  {item.changedByName || 'System'}
                </span>
                <span>•</span>
                <span>
                  {new Date(item.createdAt).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {item.notes && (
                <p className="font-switzer text-sm text-portrait-ink mt-2 bg-sky-wash/20 p-3 rounded-lg">
                  {item.notes}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
