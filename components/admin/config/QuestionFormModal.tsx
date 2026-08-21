'use client';

import { useEffect } from 'react';
import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { additionalQuestionSchema, type AdditionalQuestion } from '@/lib/validations/config';
import { createQuestion, updateQuestion } from '@/app/(admin)/admin/config/visa-listings/actions';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { X, Plus, Trash2 } from 'lucide-react';

interface Question {
  id: string;
  visaListingId: string;
  key: string;
  label: string;
  description: string | null;
  questionType: 'text' | 'date' | 'select' | 'dropdown' | 'file' | 'flight' | 'boolean';
  required: boolean;
  familyEnabled: boolean;
  onlyB2b: boolean;
  extraInfo: string | null;
  requiredDoc: string | null;
  sourceUrl: string | null;
  options: Array<{ label: string; value: string }>;
  sortOrder: number;
  createdAt: Date;
}

interface QuestionFormModalProps {
  processId: string;
  initialData: Question | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * QuestionFormModal Component
 *
 * Modal dialog for creating or editing additional questions.
 * Features:
 * - Add or Edit mode based on initialData
 * - Question type selector
 * - Conditional options editor for dropdown/select types
 * - React Hook Form with Zod validation
 * - Dynamic options array with add/remove
 */
export function QuestionFormModal({
  processId,
  initialData,
  onClose,
  onSuccess,
}: QuestionFormModalProps) {
  const isEditMode = !!initialData;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AdditionalQuestion>({
    resolver: zodResolver(additionalQuestionSchema),
    defaultValues: initialData
      ? {
          key: initialData.key,
          label: initialData.label,
          description: initialData.description || '',
          questionType: initialData.questionType,
          required: initialData.required,
          familyEnabled: initialData.familyEnabled,
          onlyB2b: initialData.onlyB2b,
          extraInfo: initialData.extraInfo || '',
          requiredDoc: initialData.requiredDoc || '',
          sourceUrl: initialData.sourceUrl || '',
          options: initialData.options || [],
        }
      : {
          key: '',
          label: '',
          description: '',
          questionType: 'text',
          required: true,
          familyEnabled: false,
          onlyB2b: false,
          extraInfo: '',
          requiredDoc: '',
          sourceUrl: '',
          options: [],
        },
  });

  const questionType = form.watch('questionType');
  const showOptions = questionType === 'dropdown' || questionType === 'select';

  // Dynamic options array
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'options',
  });

  const onSubmit = async (data: AdditionalQuestion) => {
    setIsSubmitting(true);

    try {
      const result = isEditMode
        ? await updateQuestion(initialData!.id, data)
        : await createQuestion(processId, data);

      if (result.success) {
        onSuccess();
      } else {
        alert(result.error || 'Failed to save question');
      }
    } catch (error) {
      console.error('Error saving question:', error);
      alert('Failed to save question');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-elevated max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-ash-divider p-6 flex items-center justify-between rounded-t-3xl z-10">
          <h2
            className="text-[31px] font-medium text-portrait-ink"
            style={{ fontFamily: 'Basier Circle', letterSpacing: '-0.4px' }}
          >
            {isEditMode ? 'Edit Question' : 'Add Question'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-helper/10 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-slate-helper" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-6">
          <div className="space-y-6">
            {/* Question Key */}
            <Input
              label="Question Key"
              placeholder="e.g., flight_number"
              helperText="Lowercase letters and underscores only. Used in database."
              error={form.formState.errors.key?.message}
              {...form.register('key')}
            />

            {/* Label */}
            <Input
              label="Question Label"
              placeholder="e.g., What is your flight number?"
              helperText="This is what users will see"
              error={form.formState.errors.label?.message}
              {...form.register('label')}
            />

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-portrait-ink mb-2">
                Description (Optional)
              </label>
              <textarea
                placeholder="Helper text shown below the field"
                className="w-full px-4 py-3 border border-ash-divider rounded-2xl focus:outline-none focus:ring-2 focus:ring-portrait-ink/20 transition-shadow resize-none"
                rows={3}
                {...form.register('description')}
              />
              {form.formState.errors.description && (
                <p className="mt-1 text-sm text-red-600">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>

            {/* Question Type */}
            <Select
              label="Question Type"
              options={[
                { value: 'text', label: 'Text Input' },
                { value: 'date', label: 'Date Picker' },
                { value: 'dropdown', label: 'Dropdown (Single Select)' },
                { value: 'select', label: 'Select (Single Select)' },
                { value: 'file', label: 'File Upload' },
                { value: 'flight', label: 'Flight Details' },
                { value: 'boolean', label: 'Yes/No Toggle' },
              ]}
              {...form.register('questionType')}
            />

            {/* Checkboxes */}
            <div className="space-y-4">
              <Checkbox
                label="Required"
                helperText="User must answer this question to proceed"
                checked={form.watch('required')}
                onChange={(checked) => form.setValue('required', checked)}
              />

              <Checkbox
                label="Family Enabled"
                helperText="Ask this question for all family members"
                checked={form.watch('familyEnabled')}
                onChange={(checked) => form.setValue('familyEnabled', checked)}
              />

              <Checkbox
                label="B2B Only"
                helperText="Only show in B2B portal"
                checked={form.watch('onlyB2b')}
                onChange={(checked) => form.setValue('onlyB2b', checked)}
              />
            </div>

            {/* Dropdown Options (conditional) */}
            {showOptions && (
              <div className="p-4 bg-mint-wash/30 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-portrait-ink">Dropdown Options</h4>
                  <Button
                    type="button"
                    onClick={() => append({ label: '', value: '' })}
                    variant="secondary"
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Option
                  </Button>
                </div>

                {fields.length === 0 && (
                  <p className="text-sm text-slate-helper">
                    No options added yet. Click "Add Option" to get started.
                  </p>
                )}

                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-3 items-start">
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <Input
                        label={index === 0 ? 'Label' : ''}
                        placeholder="e.g., Engineer"
                        error={form.formState.errors.options?.[index]?.label?.message}
                        {...form.register(`options.${index}.label`)}
                      />
                      <Input
                        label={index === 0 ? 'Value' : ''}
                        placeholder="e.g., engineer"
                        error={form.formState.errors.options?.[index]?.value?.message}
                        {...form.register(`options.${index}.value`)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className={`p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600 ${
                        index === 0 ? 'mt-7' : ''
                      }`}
                      aria-label="Remove option"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {form.formState.errors.options && (
                  <p className="text-sm text-red-600">
                    {typeof form.formState.errors.options === 'string'
                      ? form.formState.errors.options
                      : 'Please add at least one option'}
                  </p>
                )}
              </div>
            )}

            {/* Extra Info */}
            <div>
              <label className="block text-sm font-medium text-portrait-ink mb-2">
                Extra Info (Optional)
              </label>
              <textarea
                placeholder="Additional instructions or help text"
                className="w-full px-4 py-3 border border-ash-divider rounded-2xl focus:outline-none focus:ring-2 focus:ring-portrait-ink/20 transition-shadow resize-none"
                rows={2}
                {...form.register('extraInfo')}
              />
            </div>

            {/* Source URL */}
            <Input
              label="Source URL (Optional)"
              type="url"
              placeholder="https://embassy.gov/requirements"
              helperText="Official source for this requirement"
              error={form.formState.errors.sourceUrl?.message}
              {...form.register('sourceUrl')}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-8 pt-6 border-t border-ash-divider">
            <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update Question' : 'Create Question'}
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
