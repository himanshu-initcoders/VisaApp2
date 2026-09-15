'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { QuestionCard } from './QuestionCard';
import { QuestionFormModal } from './QuestionFormModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileQuestion, Plus } from 'lucide-react';
import { deleteQuestion, reorderQuestions } from '@/app/(admin)/admin/config/visa-listings/actions';

interface Question {
  id: string;
  visaListingId: string;
  key: string;
  label: string;
  description: string | null;
  questionType: 'text' | 'date' | 'select' | 'dropdown' | 'file' | 'flight' | 'boolean';
  category?: string | null;
  required: boolean | null;
  familyEnabled: boolean | null;
  onlyB2b: boolean | null;
  extraInfo: string | null;
  requiredDoc: string | null;
  sourceUrl: string | null;
  options: Array<{ label: string; value: string }> | null;
  visibility?: {
    enabled: true;
    sourceQuestionKey: string;
    operator: 'equals';
    value: string;
  } | null;
  sortOrder: number | null;
  createdAt: Date;
}

interface QuestionsManagerProps {
  processId: string;
  initialQuestions: Question[];
}

/**
 * QuestionsManager Component
 *
 * Main component for managing additional questions with drag-and-drop reordering.
 * Features:
 * - Drag-and-drop reordering with @dnd-kit
 * - Add new question modal
 * - Edit question modal
 * - Delete confirmation dialog
 * - Empty state
 */
export function QuestionsManager({ processId, initialQuestions }: QuestionsManagerProps) {
  const router = useRouter();
  const [questions, setQuestions] = useState(initialQuestions);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Only render drag-drop on client to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Keep list in sync after router.refresh() (useState only uses initial props once)
  useEffect(() => {
    setQuestions(initialQuestions);
  }, [initialQuestions]);

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);

    // Optimistic update
    const reordered = arrayMove(questions, oldIndex, newIndex);
    setQuestions(reordered);

    // Persist to server
    const questionIds = reordered.map((q) => q.id);
    await reorderQuestions(processId, questionIds);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deletingId) return;

    const result = await deleteQuestion(deletingId);

    if (result.success) {
      setDeletingId(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete question');
    }
  };

  // Handle modal success
  const handleModalSuccess = () => {
    setShowAddModal(false);
    setEditingQuestion(null);
    router.refresh();
  };

  // Empty state
  if (questions.length === 0) {
    return (
      <>
        <EmptyState
          icon={<FileQuestion className="h-12 w-12" />}
          title="No questions configured"
          description="Add your first dynamic question to customize the application form for this entry process."
          action={{
            label: 'Add Question',
            onClick: () => setShowAddModal(true),
          }}
        />

        {/* Add Modal */}
        {showAddModal && (
          <QuestionFormModal
            processId={processId}
            initialData={null}
            siblingQuestions={questions}
            onClose={() => setShowAddModal(false)}
            onSuccess={handleModalSuccess}
          />
        )}
      </>
    );
  }

  return (
    <>
      {/* Header with count and add button */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-slate-helper">
          {questions.length} question{questions.length !== 1 ? 's' : ''} configured
        </p>
        <Button onClick={() => setShowAddModal(true)} variant="primary" size="md">
          <Plus className="h-4 w-4 mr-2" />
          Add Question
        </Button>
      </div>

      {/* Drag-and-drop context (client-only to avoid hydration mismatch) */}
      {!isMounted ? (
        // Server-side render: simple list without drag-drop
        <div className="space-y-4">
          {questions.map((question, index) => (
            <div key={question.id} className="bg-white border border-ash-divider rounded-3xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-mint-wash flex items-center justify-center text-sm font-medium text-portrait-ink">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-medium text-portrait-ink">{question.label}</h4>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Client-side render: full drag-drop functionality
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={questions.map((q) => q.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {questions.map((question, index) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  index={index}
                  onEdit={() => setEditingQuestion(question)}
                  onDelete={() => setDeletingId(question.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <QuestionFormModal
          processId={processId}
          initialData={null}
          siblingQuestions={questions}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* Edit Modal */}
      {editingQuestion && (
        <QuestionFormModal
          processId={processId}
          initialData={editingQuestion}
          siblingQuestions={questions}
          onClose={() => setEditingQuestion(null)}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Question"
        message="Are you sure you want to delete this question? This action cannot be undone."
        confirmText="Delete Question"
        destructive
      />
    </>
  );
}
