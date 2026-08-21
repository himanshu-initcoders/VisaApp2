'use client';

import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/ui/EmptyState';

interface ConfigEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}

/**
 * EmptyState wrapper that navigates via href (for server-rendered config pages).
 */
export function ConfigEmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
}: ConfigEmptyStateProps) {
  const router = useRouter();

  return (
    <EmptyState
      icon={icon}
      title={title}
      description={description}
      action={{
        label: actionLabel,
        onClick: () => router.push(actionHref),
      }}
    />
  );
}
