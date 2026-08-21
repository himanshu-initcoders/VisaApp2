import { ReactNode } from 'react';

/**
 * Page Header Component
 *
 * Reusable header for admin pages with title and optional action buttons
 */

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="font-basier text-[44px] text-portrait-ink leading-tight tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="font-switzer text-lg text-slate-helper mt-2">
            {description}
          </p>
        )}
      </div>
      {action && <div className="ml-4">{action}</div>}
    </div>
  );
}
