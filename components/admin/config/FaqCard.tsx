'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/Button';
import { GripVertical } from 'lucide-react';

interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
}

interface FaqCardProps {
  faq: Faq;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

export function FaqCard({ faq, index, onEdit, onDelete }: FaqCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: faq.id,
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

      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-peach-wash flex items-center justify-center text-sm font-medium text-portrait-ink">
        {index + 1}
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-lg font-medium text-portrait-ink mb-2">{faq.question}</h4>

        {faq.category && (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-sky-wash text-portrait-ink inline-block mb-2">
            {faq.category}
          </span>
        )}

        <p className="text-sm text-slate-helper line-clamp-2">{faq.answer}</p>
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
