import { Card, CardContent, CardHeader } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

/**
 * StatsCard Component
 *
 * Dashboard metrics card with large numbers (Basier Circle)
 * Professional variant of Portrait design system
 */

export interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    label: string;
  };
  icon?: ReactNode;
  className?: string;
}

export function StatsCard({
  title,
  value,
  change,
  icon,
  className,
}: StatsCardProps) {
  const isPositiveChange = change && change.value > 0;
  const isNegativeChange = change && change.value < 0;

  return (
    <Card className={cn('hover:shadow-elevated transition-shadow', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="font-switzer text-sm text-slate-helper font-medium">
          {title}
        </h3>
        {icon && <div className="text-slate-helper">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="font-basier text-[31px] font-semibold text-portrait-ink leading-none">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {change && (
          <p
            className={cn(
              'font-switzer text-xs mt-2',
              isPositiveChange && 'text-green-600',
              isNegativeChange && 'text-red-600',
              !isPositiveChange && !isNegativeChange && 'text-slate-helper'
            )}
          >
            {isPositiveChange && '+'}
            {change.value}% {change.label}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
