import { Badge, getStatusVariant } from '@/components/ui';
import { travellerSummaryLabel } from '@/lib/visa/caseStatus';

export function ApplicationStatusCell({
  status,
  travellerCount = 0,
  approvedTravellerCount = 0,
  readable = false,
}: {
  status: string;
  travellerCount?: number;
  approvedTravellerCount?: number;
  /** Show underscores as spaces. */
  readable?: boolean;
}) {
  const summary = travellerSummaryLabel(
    travellerCount,
    approvedTravellerCount
  );

  return (
    <div>
      <Badge variant={getStatusVariant(status)}>
        {readable ? status.replace(/_/g, ' ') : status}
      </Badge>
      {summary ? (
        <p className="mt-1 font-switzer text-xs text-slate-helper">{summary}</p>
      ) : null}
    </div>
  );
}
