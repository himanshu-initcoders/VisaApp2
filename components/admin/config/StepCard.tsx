'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/Button';
import { GripVertical } from 'lucide-react';

interface Step {
  id: string;
  heading: string;
  subheading: string | null;
}

interface StepCardProps {
  step: Step;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

export function StepCard({ step, index, onEdit, onDelete }: StepCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
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

      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-mint-wash flex items-center justify-center text-sm font-medium text-portrait-ink">
        {index + 1}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-lg font-medium text-portrait-ink mb-1">{step.heading}</h4>
        {step.subheading && (
          <p className="text-sm text-slate-helper">{step.subheading}</p>
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
