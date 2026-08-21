'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { postCheckoutStepSchema, type PostCheckoutStep } from '@/lib/validations/config';
import { createPostCheckoutStep, updatePostCheckoutStep } from '@/app/(admin)/admin/config/visa-listings/actions';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-elevated max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-ash-divider p-6 flex items-center justify-between rounded-t-3xl z-10">
          <h2
            className="text-[31px] font-medium text-portrait-ink"
            style={{ fontFamily: 'Basier Circle', letterSpacing: '-0.4px' }}
          >
            {isEditMode ? 'Edit Step' : 'Add Step'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-helper/10 rounded-full transition-colors"
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

          <div className="flex gap-3 mt-8 pt-6 border-t border-ash-divider">
            <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update Step' : 'Create Step'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost" size="md">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
