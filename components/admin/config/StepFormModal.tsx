'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { postCheckoutStepSchema, type PostCheckoutStep } from '@/lib/validations/config';
import { createPostCheckoutStep, updatePostCheckoutStep } from '@/app/(admin)/admin/config/visa-listings/actions';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ModalFrame } from '@/components/ui/ModalFrame';
import { X } from 'lucide-react';

interface StepData {
  id: string;
  visaListingId: string;
  heading: string;
  subheading: string | null;
  sortOrder: number | null;
  createdAt: Date;
}

interface StepFormModalProps {
  processId: string;
  initialData: StepData | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function StepFormModal({ processId, initialData, onClose, onSuccess }: StepFormModalProps) {
  const isEditMode = !!initialData;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PostCheckoutStep>({
    resolver: zodResolver(postCheckoutStepSchema),
    defaultValues: initialData
      ? {
          heading: initialData.heading,
          subheading: initialData.subheading || '',
          sortOrder: initialData.sortOrder ?? 0,
        }
      : {
          heading: '',
          subheading: '',
          sortOrder: 0,
        },
  });

  const onSubmit = async (data: PostCheckoutStep) => {
    setIsSubmitting(true);

    try {
      const result = isEditMode
        ? await updatePostCheckoutStep(initialData!.id, data)
        : await createPostCheckoutStep(processId, data);

      if (result.success) {
        onSuccess();
      } else {
        alert(result.error || 'Failed to save step');
      }
    } catch (error) {
      console.error('Error saving step:', error);
      alert('Failed to save step');
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
          {isEditMode ? 'Edit Step' : 'Add Step'}
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
            label="Heading"
            placeholder="Document Verification"
            error={form.formState.errors.heading?.message}
            {...form.register('heading')}
          />

          <Input
            label="Subheading (Optional)"
            placeholder="We'll verify your documents within 2 hours"
            error={form.formState.errors.subheading?.message}
            {...form.register('subheading')}
          />
        </div>

        <div className="mt-8 flex gap-3 border-t border-ash-divider pt-6">
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
            {isSubmitting
              ? 'Saving...'
              : isEditMode
                ? 'Update Step'
                : 'Create Step'}
          </Button>
          <Button type="button" onClick={onClose} variant="ghost" size="md">
            Cancel
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}
