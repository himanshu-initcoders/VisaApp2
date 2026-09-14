'use client';

import { Trash2 } from 'lucide-react';
import { FilledBadge } from '@/components/apply/review/FilledBadge';
import { formatProfileName } from '@/lib/apply/travellerProfiles';
import { cn } from '@/lib/utils';

interface TravellerSidebarItemProps {
  name: string;
  filled: boolean;
  selected: boolean;
  canRemove: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

export function TravellerSidebarItem({
  name,
  filled,
  selected,
  canRemove,
  onSelect,
  onRemove,
}: TravellerSidebarItemProps) {
  const displayName = formatProfileName(name) || 'Traveller';

  return (
    <div
      className={cn(
        'group flex items-center gap-2 rounded-2xl px-3 py-2.5 transition-colors',
        selected ? 'bg-[#eef4ff]' : 'hover:bg-white'
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        {filled ? (
          <FilledBadge className="h-5 w-5 shrink-0" />
        ) : (
          <span className="h-5 w-5 shrink-0 rounded-full border border-fog" />
        )}
        <span
          className={cn(
            'truncate text-sm font-medium',
            selected ? 'text-[#3b82f6]' : 'text-portrait-ink'
          )}
        >
          {displayName}
        </span>
      </button>
      {canRemove && (
        <button
          type="button"
          aria-label={`Remove ${displayName}`}
          onClick={onRemove}
          className="rounded-full p-1 text-slate-helper opacity-0 transition-opacity hover:bg-peach-wash hover:text-[#ff4940] group-hover:opacity-100 focus:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
