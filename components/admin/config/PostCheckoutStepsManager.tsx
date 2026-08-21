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
import { StepCard } from './StepCard';
import { StepFormModal } from './StepFormModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Clock, Plus } from 'lucide-react';
import { deletePostCheckoutStep, reorderPostCheckoutSteps } from '@/app/(admin)/admin/config/visa-listings/actions';

interface Step {
  id: string;
  visaListingId: string;
  heading: string;
  subheading: string | null;
  sortOrder: number | null;
  createdAt: Date;
}

interface PostCheckoutStepsManagerProps {
  processId: string;
  initialSteps: Step[];
}

export function PostCheckoutStepsManager({ processId, initialSteps }: PostCheckoutStepsManagerProps) {
  const router = useRouter();
  const [steps, setSteps] = useState(initialSteps);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Keep list in sync after router.refresh() (useState only uses initial props once)
  useEffect(() => {
    setSteps(initialSteps);
  }, [initialSteps]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);

    const reordered = arrayMove(steps, oldIndex, newIndex);
    setSteps(reordered);

    const stepIds = reordered.map((s) => s.id);
    await reorderPostCheckoutSteps(processId, stepIds);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    const result = await deletePostCheckoutStep(deletingId);
    if (result.success) {
      setDeletingId(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete step');
    }
  };

  const handleModalSuccess = () => {
    setShowAddModal(false);
    setEditingStep(null);
    router.refresh();
  };

  if (steps.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Clock className="h-12 w-12" />}
          title="No timeline steps configured"
          description="Add steps to show users what happens after they complete payment."
          action={{
            label: 'Add Step',
            onClick: () => setShowAddModal(true),
          }}
        />
        {showAddModal && (
          <StepFormModal
            processId={processId}
            initialData={null}
            onClose={() => setShowAddModal(false)}
            onSuccess={handleModalSuccess}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-slate-helper">
          {steps.length} step{steps.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={() => setShowAddModal(true)} variant="primary" size="md">
          <Plus className="h-4 w-4 mr-2" />
          Add Step
        </Button>
      </div>

      {!isMounted ? (
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="bg-white border border-ash-divider rounded-3xl p-6">
              <h4 className="text-lg font-medium text-portrait-ink">{step.heading}</h4>
            </div>
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {steps.map((step, index) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={index}
                  onEdit={() => setEditingStep(step)}
                  onDelete={() => setDeletingId(step.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showAddModal && (
        <StepFormModal
          processId={processId}
          initialData={null}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}

      {editingStep && (
        <StepFormModal
          processId={processId}
          initialData={editingStep}
          onClose={() => setEditingStep(null)}
          onSuccess={handleModalSuccess}
        />
      )}

      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Step"
        message="Are you sure you want to delete this step? This action cannot be undone."
        confirmText="Delete Step"
        destructive
      />
    </>
  );
}
