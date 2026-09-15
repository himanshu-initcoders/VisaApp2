'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/Button';
import { documentTypeLabel } from '@/lib/document-types';
import { GripVertical } from 'lucide-react';

interface Component {
  id: string;
  key: string;
  documentType?: string | null;
  label?: string | null;
  amount: string | null;
  chargeable: boolean | null;
  familyEnabled: boolean | null;
  onlyB2b: boolean | null;
  toggle: boolean | null;
  attributes: string[] | null;
  sourceUrl: string | null;
}

interface ComponentCardProps {
  component: Component;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

function displayTitle(component: Component) {
  if (component.label?.trim()) return component.label.trim();
  if (component.documentType) return documentTypeLabel(component.documentType);
  return component.key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * ComponentCard — document requirement row with drag handle and actions.
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-ash-divider rounded-3xl p-6 flex items-start gap-4 hover:shadow-card transition-shadow"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-helper hover:text-portrait-ink p-2 -m-2 transition-colors flex-shrink-0"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-sky-wash flex items-center justify-center text-sm font-medium text-portrait-ink">
        {index + 1}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-lg font-medium text-portrait-ink mb-2">{displayTitle(component)}</h4>
        {component.documentType && (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-sky-wash text-portrait-ink">
            {documentTypeLabel(component.documentType)}
          </span>
        )}
      </div>

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
