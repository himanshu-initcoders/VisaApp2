'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FaqCard } from './FaqCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { HelpCircle, Plus, X } from 'lucide-react';
import { faqSchema, type FAQ } from '@/lib/validations/config';
import {
  createPassportFaq,
  updatePassportFaq,
  deletePassportFaq,
  reorderPassportFaqs,
} from '@/app/(admin)/admin/config/passport-listings/actions';

interface PassportFaqRow {
  id: string;
  passportListingId: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number | null;
  createdAt: Date;
}

interface PassportFaqsManagerProps {
  listingId: string;
  initialFaqs: PassportFaqRow[];
}

export function PassportFaqsManager({
  listingId,
  initialFaqs,
}: PassportFaqsManagerProps) {
  const router = useRouter();
  const [faqs, setFaqs] = useState(initialFaqs);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PassportFaqRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);
  useEffect(() => setFaqs(initialFaqs), [initialFaqs]);

  const form = useForm<FAQ>({
    resolver: zodResolver(faqSchema),
    defaultValues: { question: '', answer: '', category: '', sortOrder: 0 },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const openCreate = () => {
    setEditing(null);
    form.reset({ question: '', answer: '', category: '', sortOrder: 0 });
    setShowModal(true);
  };

  const openEdit = (faq: PassportFaqRow) => {
    setEditing(faq);
    form.reset({
      question: faq.question,
      answer: faq.answer,
      category: faq.category || '',
      sortOrder: faq.sortOrder ?? 0,
    });
    setShowModal(true);
  };

  const onSubmit = async (data: FAQ) => {
    const result = editing
      ? await updatePassportFaq(editing.id, data)
      : await createPassportFaq(listingId, data);
    if (result.success) {
      setShowModal(false);
      setEditing(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to save FAQ');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = faqs.findIndex((f) => f.id === active.id);
    const newIndex = faqs.findIndex((f) => f.id === over.id);
    const reordered = arrayMove(faqs, oldIndex, newIndex);
    setFaqs(reordered);
    await reorderPassportFaqs(
      listingId,
      reordered.map((f) => f.id)
    );
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const result = await deletePassportFaq(deletingId);
    if (result.success) {
      setDeletingId(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete');
    }
  };

  if (faqs.length === 0 && !showModal) {
    return (
      <EmptyState
        icon={<HelpCircle className="h-12 w-12" />}
        title="No FAQs yet"
        description="Add questions applicants commonly ask about this passport product."
        action={{ label: 'Add FAQ', onClick: openCreate }}
      />
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-helper">
          {faqs.length} FAQ{faqs.length !== 1 ? 's' : ''}
        </p>
        <Button type="button" variant="primary" onClick={openCreate}>
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4 shrink-0" />
            Add FAQ
          </span>
        </Button>
      </div>

      {isMounted ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={faqs.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <FaqCard
                  key={faq.id}
                  faq={faq}
                  index={index}
                  onEdit={() => openEdit(faq)}
                  onDelete={() => setDeletingId(faq.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <FaqCard
              key={faq.id}
              faq={faq}
              index={index}
              onEdit={() => openEdit(faq)}
              onDelete={() => setDeletingId(faq.id)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowModal(false)}
          />
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-elevated">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-medium text-portrait-ink">
                {editing ? 'Edit FAQ' : 'Add FAQ'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Question"
                error={form.formState.errors.question?.message}
                {...form.register('question')}
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-portrait-ink">
                  Answer
                </label>
                <textarea
                  rows={6}
                  className="w-full rounded-2xl border border-ash-divider px-4 py-3 text-sm"
                  {...form.register('answer')}
                />
                {form.formState.errors.answer && (
                  <p className="mt-1 text-sm text-red-600">
                    {form.formState.errors.answer.message}
                  </p>
                )}
              </div>
              <Input label="Category (optional)" {...form.register('category')} />
              <Button type="submit" variant="primary" className="w-full">
                Save FAQ
              </Button>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete FAQ"
        message="Are you sure you want to delete this FAQ?"
        confirmText="Delete"
        destructive
      />
    </>
  );
}
