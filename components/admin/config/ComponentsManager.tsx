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
import { ComponentCard } from './ComponentCard';
import { ComponentFormModal } from './ComponentFormModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileCheck, Plus } from 'lucide-react';
import { deleteComponent, reorderComponents } from '@/app/(admin)/admin/config/visa-listings/actions';

interface Component {
  id: string;
  visaListingId: string;
  key: string;
  amount: string;
  chargeable: boolean;
  familyEnabled: boolean;
  onlyB2b: boolean;
  toggle: boolean;
  attributes: string[];
  sourceUrl: string | null;
  sortOrder: number;
  createdAt: Date;
}

interface ComponentsManagerProps {
  processId: string;
  initialComponents: Component[];
}

/**
 * ComponentsManager Component
 *
 * Main component for managing document requirements with drag-and-drop reordering.
 */
export function ComponentsManager({ processId, initialComponents }: ComponentsManagerProps) {
  const router = useRouter();
  const [components, setComponents] = useState(initialComponents);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Reset list when switching to a different listing
  useEffect(() => {
    setComponents(initialComponents);
  }, [processId]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = components.findIndex((c) => c.id === active.id);
    const newIndex = components.findIndex((c) => c.id === over.id);

    const reordered = arrayMove(components, oldIndex, newIndex);
    setComponents(reordered);

    const componentIds = reordered.map((c) => c.id);
    await reorderComponents(processId, componentIds);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    const result = await deleteComponent(deletingId);

    if (result.success) {
      setComponents((prev) => prev.filter((c) => c.id !== deletingId));
      setDeletingId(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete document requirement');
    }
  };

  const handleModalSuccess = (component: Component) => {
    setComponents((prev) => {
      const existingIndex = prev.findIndex((c) => c.id === component.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = component;
        return next;
      }
      return [...prev, component].sort((a, b) => a.sortOrder - b.sortOrder);
    });
    setShowAddModal(false);
    setEditingComponent(null);
    router.refresh();
  };

  if (components.length === 0) {
    return (
      <>
        <EmptyState
          icon={<FileCheck className="h-12 w-12" />}
          title="No documents configured"
          description="Add your first document requirement to specify what documents users need to provide for this visa listing."
          action={{
            label: 'Add Document',
            onClick: () => setShowAddModal(true),
          }}
        />

        {showAddModal && (
          <ComponentFormModal
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
          {components.length} document{components.length !== 1 ? 's' : ''} required
        </p>
        <Button onClick={() => setShowAddModal(true)} variant="primary" size="md">
          <Plus className="h-4 w-4 mr-2" />
          Add Document
        </Button>
      </div>

      {!isMounted ? (
        <div className="space-y-4">
          {components.map((component, index) => (
            <div key={component.id} className="bg-white border border-ash-divider rounded-3xl p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-mint-wash flex items-center justify-center text-sm font-medium text-portrait-ink">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-medium text-portrait-ink">{component.key}</h4>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={components.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {components.map((component, index) => (
                <ComponentCard
                  key={component.id}
                  component={component}
                  index={index}
                  onEdit={() => setEditingComponent(component)}
                  onDelete={() => setDeletingId(component.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showAddModal && (
        <ComponentFormModal
          processId={processId}
          initialData={null}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}

      {editingComponent && (
        <ComponentFormModal
          processId={processId}
          initialData={editingComponent}
          onClose={() => setEditingComponent(null)}
          onSuccess={handleModalSuccess}
        />
      )}

      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Document Requirement"
        message="Are you sure you want to delete this document requirement? This action cannot be undone."
        confirmText="Delete Document"
        destructive
      />
    </>
  );
}
