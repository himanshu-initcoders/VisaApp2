import {
  formatReviewValue,
  type ReviewFieldGroup,
} from '@/lib/apply/reviewFields';
import type { IndianPassportFields } from '@/lib/passport/types';

interface ReviewFieldGridProps {
  groups: ReviewFieldGroup[];
  data: IndianPassportFields;
}

export function ReviewFieldGrid({ groups, data }: ReviewFieldGridProps) {
  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const rows = group.fields
          .map((field) => ({
            ...field,
            value: formatReviewValue(field.key, data[field.key] || ''),
          }))
          .filter((field) => field.value);

        if (rows.length === 0) return null;

        return (
          <div key={group.title}>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
              {group.title}
            </h4>
            <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {rows.map((field) => (
                <div key={field.key} className="min-w-0">
                  <dt className="text-xs text-slate-helper">{field.label}</dt>
                  <dd className="truncate text-sm font-medium text-portrait-ink">
                    {field.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
