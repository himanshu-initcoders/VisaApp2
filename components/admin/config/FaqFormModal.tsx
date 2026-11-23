'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { faqSchema, type FAQ } from '@/lib/validations/config';
import { createFaq, updateFaq } from '@/app/(admin)/admin/config/visa-listings/actions';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ModalFrame } from '@/components/ui/ModalFrame';
import { X } from 'lucide-react';

interface FaqData {
  id: string;
  visaListingId: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number | null;
  createdAt: Date;
}

interface FaqFormModalProps {
  processId: string;
  initialData: FaqData | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function FaqFormModal({ processId, initialData, onClose, onSuccess }: FaqFormModalProps) {
  const isEditMode = !!initialData;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FAQ>({
    resolver: zodResolver(faqSchema),
    defaultValues: initialData
      ? {
          question: initialData.question,
          answer: initialData.answer,
          category: initialData.category || '',
          sortOrder: initialData.sortOrder ?? 0,
        }
      : {
          question: '',
          answer: '',
          category: '',
          sortOrder: 0,
        },
  });

  const onSubmit = async (data: FAQ) => {
    setIsSubmitting(true);

    try {
      const result = isEditMode
        ? await updateFaq(initialData!.id, data)
        : await createFaq(processId, data);

      if (result.success) {
        onSuccess();
      } else {
        alert(result.error || 'Failed to save FAQ');
      }
    } catch (error) {
      console.error('Error saving FAQ:', error);
      alert('Failed to save FAQ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalFrame onClose={onClose}>
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl border-b border-ash-divider bg-white p-6">
        <h2
          className="text-[31px] font-medium text-portrait-ink"
          style={{ fontFamily: 'Basier Circle', letterSpacing: '-0.4px' }}
        >
          {isEditMode ? 'Edit FAQ' : 'Add FAQ'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 transition-colors hover:bg-slate-helper/10"
        >
          <X className="h-5 w-5 text-slate-helper" />
        </button>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="p-6">
        <div className="space-y-6">
          <Input
            label="Question"
            placeholder="What documents do I need?"
            error={form.formState.errors.question?.message}
            {...form.register('question')}
          />

          <div>
            <label className="mb-2 block text-sm font-medium text-portrait-ink">
              Answer
            </label>
            <textarea
              placeholder="Answer in markdown format..."
              className="w-full resize-none rounded-2xl border border-ash-divider px-4 py-3 transition-shadow focus:outline-none focus:ring-2 focus:ring-portrait-ink/20"
              rows={8}
              {...form.register('answer')}
            />
            {form.formState.errors.answer && (
              <p className="mt-1 text-sm text-red-600">
                {form.formState.errors.answer.message}
              </p>
            )}
          </div>

          <Input
            label="Category (Optional)"
            placeholder="e.g., Documents, Payment, Timeline"
            error={form.formState.errors.category?.message}
            {...form.register('category')}
          />
        </div>

        <div className="mt-8 flex gap-3 border-t border-ash-divider pt-6">
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
            {isSubmitting
              ? 'Saving...'
              : isEditMode
                ? 'Update FAQ'
                : 'Create FAQ'}
          </Button>
          <Button type="button" onClick={onClose} variant="ghost" size="md">
            Cancel
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}
