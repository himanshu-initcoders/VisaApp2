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
import { FaqCard } from './FaqCard';
import { FaqFormModal } from './FaqFormModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { HelpCircle, Plus } from 'lucide-react';
import { deleteFaq, reorderFaqs } from '@/app/(admin)/admin/config/visa-listings/actions';

interface Faq {
  id: string;
  visaListingId: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
  createdAt: Date;
}

interface FaqsManagerProps {
  processId: string;
  initialFaqs: Faq[];
}

export function FaqsManager({ processId, initialFaqs }: FaqsManagerProps) {
  const router = useRouter();
  const [faqs, setFaqs] = useState(initialFaqs);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState<Faq | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = faqs.findIndex((f) => f.id === active.id);
    const newIndex = faqs.findIndex((f) => f.id === over.id);

    const reordered = arrayMove(faqs, oldIndex, newIndex);
    setFaqs(reordered);

    const faqIds = reordered.map((f) => f.id);
    await reorderFaqs(processId, faqIds);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    const result = await deleteFaq(deletingId);
    if (result.success) {
      setDeletingId(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete FAQ');
    }
  };

  const handleModalSuccess = () => {
    setShowAddModal(false);
    setEditingFaq(null);
    router.refresh();
  };

  if (faqs.length === 0) {
    return (
      <>
        <EmptyState
          icon={<HelpCircle className="h-12 w-12" />}
          title="No FAQs configured"
          description="Add your first FAQ to help users understand the visa process."
          action={{
            label: 'Add FAQ',
            onClick: () => setShowAddModal(true),
          }}
        />
        {showAddModal && (
          <FaqFormModal
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
          {faqs.length} FAQ{faqs.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={() => setShowAddModal(true)} variant="primary" size="md">
          <Plus className="h-4 w-4 mr-2" />
          Add FAQ
        </Button>
      </div>

      {!isMounted ? (
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={faq.id} className="bg-white border border-ash-divider rounded-3xl p-6">
              <h4 className="text-lg font-medium text-portrait-ink">{faq.question}</h4>
            </div>
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={faqs.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <FaqCard
                  key={faq.id}
                  faq={faq}
                  index={index}
                  onEdit={() => setEditingFaq(faq)}
                  onDelete={() => setDeletingId(faq.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showAddModal && (
        <FaqFormModal
          processId={processId}
          initialData={null}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}

      {editingFaq && (
        <FaqFormModal
          processId={processId}
          initialData={editingFaq}
          onClose={() => setEditingFaq(null)}
          onSuccess={handleModalSuccess}
        />
      )}

      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete FAQ"
        message="Are you sure you want to delete this FAQ? This action cannot be undone."
        confirmText="Delete FAQ"
        destructive
      />
    </>
  );
}
