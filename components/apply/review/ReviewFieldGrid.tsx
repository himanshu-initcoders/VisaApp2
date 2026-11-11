import {
  formatReviewValue,
  type ReviewFieldGroup,
} from '@/lib/apply/reviewFields';
import type { IndianPassportFields } from '@/lib/passport/types';

interface ReviewFieldGridProps {
  groups: ReviewFieldGroup[];
  data: IndianPassportFields;
  /** Group titles already shown by the parent section. */
  hideTitles?: string[];
}

const FULL_WIDTH_KEYS = new Set<keyof IndianPassportFields>([
  'address',
  'email',
]);

export function ReviewFieldGrid({
  groups,
  data,
  hideTitles = [],
}: ReviewFieldGridProps) {
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

        const showTitle = !hideTitles.includes(group.title);

        return (
          <div key={group.title}>
            {showTitle && (
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
                {group.title}
              </h4>
            )}
            <dl
              className={
                showTitle
                  ? 'mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2'
                  : 'grid gap-x-6 gap-y-3 sm:grid-cols-2'
              }
            >
              {rows.map((field) => {
                const fullWidth =
                  FULL_WIDTH_KEYS.has(field.key) || field.value.length > 48;
                return (
                  <div
                    key={field.key}
                    className={fullWidth ? 'min-w-0 sm:col-span-2' : 'min-w-0'}
                  >
                    <dt className="text-xs text-slate-helper">{field.label}</dt>
                    <dd className="whitespace-pre-wrap break-words text-sm font-medium text-portrait-ink">
                      {field.value}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
