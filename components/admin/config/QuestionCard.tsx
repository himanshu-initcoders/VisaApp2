'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/Button';
import { GripVertical } from 'lucide-react';

interface Question {
  id: string;
  key: string;
  label: string;
  description: string | null;
  questionType: 'text' | 'date' | 'select' | 'dropdown' | 'file' | 'flight' | 'boolean';
  required: boolean;
  familyEnabled: boolean;
  onlyB2b: boolean;
  options: Array<{ label: string; value: string }>;
}

interface QuestionCardProps {
  question: Question;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * QuestionCard Component
 *
 * Displays a single question with drag handle and actions.
 * Features:
 * - Drag handle for reordering
 * - Question type badge with color coding
 * - Required/Optional badge
 * - Family-enabled badge
 * - B2B-only badge
 * - Options count for dropdowns
 * - Edit and Delete buttons
 */
export function QuestionCard({ question, index, onEdit, onDelete }: QuestionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Get question type color
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'dropdown':
      case 'select':
        return 'bg-mint-wash text-portrait-ink';
      case 'file':
        return 'bg-peach-wash text-portrait-ink';
      case 'date':
        return 'bg-sky-wash text-portrait-ink';
      case 'boolean':
        return 'bg-mint-wash/50 text-portrait-ink';
      default:
        return 'bg-fog-edge text-portrait-ink';
    }
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

      {/* Question Number */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-mint-wash flex items-center justify-center text-sm font-medium text-portrait-ink">
        {index + 1}
      </div>

      {/* Question Content */}
      <div className="flex-1 min-w-0">
        {/* Label */}
        <h4 className="text-lg font-medium text-portrait-ink mb-2">{question.label}</h4>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Type Badge */}
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(
              question.questionType
            )}`}
          >
            {question.questionType}
          </span>

          {/* Required Badge */}
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              question.required
                ? 'bg-peach-wash text-portrait-ink'
                : 'bg-fog-edge text-slate-helper'
            }`}
          >
            {question.required ? 'Required' : 'Optional'}
          </span>

          {/* Family Badge */}
          {question.familyEnabled && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-sky-wash text-portrait-ink">
              Family
            </span>
          )}

          {/* B2B Only Badge */}
          {question.onlyB2b && (
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-fog-edge text-portrait-ink">
              B2B Only
            </span>
          )}
        </div>

        {/* Description */}
        {question.description && (
          <p className="text-sm text-slate-helper mb-2 line-clamp-2">{question.description}</p>
        )}

        {/* Options count for dropdowns */}
        {(question.questionType === 'dropdown' || question.questionType === 'select') && (
          <p className="text-xs text-slate-helper">
            {question.options?.length || 0} option{question.options?.length !== 1 ? 's' : ''}{' '}
            configured
          </p>
        )}

        {/* Question key */}
        <p className="text-xs text-slate-helper/60 mt-2 font-mono">Key: {question.key}</p>
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
