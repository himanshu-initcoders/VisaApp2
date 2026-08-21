'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/Button';
import { GripVertical } from 'lucide-react';

interface Component {
  id: string;
  key: string;
  amount: string;
  chargeable: boolean;
  familyEnabled: boolean;
  onlyB2b: boolean;
  toggle: boolean;
  attributes: string[];
  sourceUrl: string | null;
}

interface ComponentCardProps {
  component: Component;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * ComponentCard Component
 *
 * Displays a single document requirement with drag handle and actions.
 * Features:
 * - Drag handle for reordering
 * - Document key display
 * - Chargeable badge with fee amount
 * - Required/Optional indicator
 * - Family-enabled badge
 * - B2B-only badge
 * - Attributes display
 * - Edit and Delete buttons
 */
export function ComponentCard({ component, index, onEdit, onDelete }: ComponentCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: component.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Format document key for display
  const formatKey = (key: string) => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-ash-divider rounded-3xl p-6 flex items-start gap-4 hover:shadow-card transition-shadow"
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-helper hover:text-portrait-ink p-2 -m-2 transition-colors flex-shrink-0"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Document Number */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-sky-wash flex items-center justify-center text-sm font-medium text-portrait-ink">
        {index + 1}
      </div>

      {/* Document Content */}
      <div className="flex-1 min-w-0">
        {/* Document Name */}
        <h4 className="text-lg font-medium text-portrait-ink mb-2">{formatKey(component.key)}</h4>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Chargeable Badge */}
          {component.chargeable ? (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-peach-wash text-portrait-ink">
              Chargeable: ₹{parseFloat(component.amount).toLocaleString()}
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-mint-wash text-portrait-ink">
              Free
            </span>
          )}

          {/* Family Badge */}
          {component.familyEnabled && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-sky-wash text-portrait-ink">
              Family
            </span>
          )}

          {/* B2B Only Badge */}
          {component.onlyB2b && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-fog-edge text-portrait-ink">
              B2B Only
            </span>
          )}

          {/* Toggle Badge */}
          {component.toggle && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-mint-wash/50 text-portrait-ink">
              Optional
            </span>
          )}
        </div>

        {/* Validation Attributes */}
        {component.attributes && component.attributes.length > 0 && (
          <div className="mb-2">
            <p className="text-xs text-slate-helper mb-1">Validation attributes:</p>
            <div className="flex flex-wrap gap-1">
              {component.attributes.map((attr, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 rounded-lg text-xs bg-fog-edge/50 text-portrait-ink"
                >
                  {attr.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Document key */}
        <p className="text-xs text-slate-helper/60 mt-2 font-mono">Key: {component.key}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-shrink-0">
        <Button onClick={onEdit} variant="secondary" size="sm">
          Edit
        </Button>
        <Button onClick={onDelete} variant="ghost" size="sm">
          Delete
        </Button>
      </div>
    </div>
  );
}
