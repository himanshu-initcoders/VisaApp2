'use client';

import { AddTravellerCard } from '@/components/apply/review/AddTravellerCard';
import { TravellerSidebarItem } from '@/components/apply/review/TravellerSidebarItem';
import {
  isTravellerFilled,
  travellerDisplayName,
} from '@/lib/apply/reviewFields';
import type { ApplyTraveller } from '@/lib/apply/types';

interface TravellerSidebarProps {
  travellers: ApplyTraveller[];
  selectedId: string | null;
  canAdd: boolean;
  onSelect: (id: string) => void;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
}

export function TravellerSidebar({
  travellers,
  selectedId,
  canAdd,
  onSelect,
  onAdd,
  onRemove,
}: TravellerSidebarProps) {
  return (
    <aside className="flex w-full shrink-0 flex-col rounded-[24px] border border-white bg-white/80 p-3 shadow-card lg:w-[260px]">
      <div className="space-y-1">
        {travellers.map((traveller, index) => (
          <TravellerSidebarItem
            key={traveller.id}
            name={travellerDisplayName(traveller, index)}
            filled={isTravellerFilled(traveller)}
            selected={selectedId === traveller.id}
            canRemove={travellers.length > 1}
            onSelect={() => onSelect(traveller.id)}
            onRemove={() => onRemove(traveller.id)}
          />
        ))}
      </div>
      <div className="mt-2 border-t border-mist pt-2">
        <AddTravellerCard disabled={!canAdd} onAdd={onAdd} />
      </div>
    </aside>
  );
}
