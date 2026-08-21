import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

/**
 * EmptyState Component - Portrait Design System
 *
 * A reusable empty state component for showing when no data exists.
 * Features centered layout with icon, title, description, and optional CTA.
 *
 * @example
 * <EmptyState
 *   icon={<Globe className="h-12 w-12" />}
 *   title="No countries added yet"
 *   description="Add your first country to start offering visa services."
 *   action={{
 *     label: "Add Country",
 *     onClick: () => setShowModal(true)
 *   }}
 * />
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border border-ash-divider',
        className
      )}
    >
      {/* Icon */}
      {icon && (
        <div className="mb-4 text-slate-helper">
          {icon}
        </div>
      )}

      {/* Title */}
      <h3
        className="text-[31px] font-medium leading-tight tracking-tight text-portrait-ink mb-2"
        style={{ fontFamily: 'Basier Circle, sans-serif' }}
      >
        {title}
      </h3>

      {/* Description */}
      <p className="text-base text-slate-helper max-w-md mb-6">
        {description}
      </p>

      {/* Action */}
      {action && (
        <Button
          variant="primary"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
