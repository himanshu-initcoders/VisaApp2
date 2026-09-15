'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { additionalQuestionSchema, type AdditionalQuestion } from '@/lib/validations/config';
import {
  createQuestion,
  updateQuestion,
  suggestQuestions,
} from '@/app/(admin)/admin/config/visa-listings/actions';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Toggle } from '@/components/ui/Toggle';
import { Button } from '@/components/ui/Button';
import {
  QUESTION_CATEGORIES,
  isQuestionCategory,
  questionCategoryLabel,
  type QuestionCategory,
} from '@/lib/question-categories';
import {
  adaptVisibilityForListing,
  normalizeQuestionVisibility,
  type QuestionVisibility,
} from '@/lib/question-visibility';
import { X, Plus, Trash2 } from 'lucide-react';
import { z } from 'zod';

type QuestionFormValues = z.input<typeof additionalQuestionSchema>;

type QuestionLabelSuggestion = {
  id: string;
  label: string;
  description: string | null;
  questionType: 'text' | 'date' | 'select' | 'dropdown' | 'file' | 'flight' | 'boolean';
  category: string;
  required: boolean | null;
  options: Array<{ label: string; value: string }> | null;
  visibility?: QuestionVisibility;
};

type AdminQuestionType = 'text' | 'date' | 'dropdown' | 'boolean';

export type SiblingQuestion = {
  id: string;
  key: string;
  label: string;
  questionType: string;
  options: Array<{ label: string; value: string }> | null;
  visibility?: QuestionVisibility;
};

function toAdminQuestionType(type: string): AdminQuestionType {
  if (type === 'date') return 'date';
  if (type === 'boolean') return 'boolean';
  if (type === 'dropdown' || type === 'select') return 'dropdown';
  return 'text';
}

function toAdminCategory(value: string | null | undefined): QuestionCategory {
  return value && isQuestionCategory(value) ? value : 'other';
}

/** UI-only: rule is "on" even while value is still being filled in. */
function isVisibilityDraftEnabled(visibility: unknown): boolean {
  return Boolean(
    visibility &&
      typeof visibility === 'object' &&
      'enabled' in visibility &&
      (visibility as { enabled?: boolean }).enabled === true
  );
}

/** Default equals-value when picking a source question (so selects aren't visually selected but empty). */
function defaultEqualsValueForSibling(sibling: SiblingQuestion | undefined): string {
  if (!sibling) return '';
  const type = toAdminQuestionType(sibling.questionType);
  if (type === 'boolean') return 'true';
  if (type === 'dropdown') return sibling.options?.[0]?.value ?? '';
  return '';
}

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
  visibility?: QuestionVisibility;
  sortOrder: number | null;
  createdAt: Date;
}

interface QuestionFormModalProps {
  processId: string;
  initialData: Question | null;
  siblingQuestions: SiblingQuestion[];
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * QuestionFormModal Component
 *
 * Modal for creating/editing additional questions, including optional show-if visibility.
 */
export function QuestionFormModal({
  processId,
  initialData,
  siblingQuestions,
  onClose,
  onSuccess,
}: QuestionFormModalProps) {
  const isEditMode = !!initialData;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<QuestionLabelSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const labelWrapRef = useRef<HTMLDivElement>(null);
  const skipNextSearchRef = useRef(false);

  const availableSiblings = useMemo(
    () => siblingQuestions.filter((q) => q.id !== initialData?.id),
    [siblingQuestions, initialData?.id]
  );

  const listingKeys = useMemo(
    () => new Set(availableSiblings.map((q) => q.key)),
    [availableSiblings]
  );

  const initialVisibility = normalizeQuestionVisibility(initialData?.visibility);

  const form = useForm<QuestionFormValues, unknown, AdditionalQuestion>({
    resolver: zodResolver(additionalQuestionSchema),
    defaultValues: initialData
      ? {
          label: initialData.label,
          description: initialData.description || '',
          questionType: toAdminQuestionType(initialData.questionType),
          category: toAdminCategory(initialData.category),
          required: initialData.required ?? true,
          requiredDoc: initialData.requiredDoc || '',
          options: initialData.options || [],
          visibility: initialVisibility,
        }
      : {
          label: '',
          description: '',
          questionType: 'text',
          category: 'other',
          required: true,
          requiredDoc: '',
          options: [],
          visibility: null,
        },
  });

  const questionType = form.watch('questionType');
  const labelValue = form.watch('label');
  const visibility = form.watch('visibility');
  const visibilityEnabled = isVisibilityDraftEnabled(visibility);
  const showOptions = questionType === 'dropdown';

  const sourceKey = String(
    visibility && typeof visibility === 'object' && visibility !== null && 'sourceQuestionKey' in visibility
      ? ((visibility as { sourceQuestionKey?: unknown }).sourceQuestionKey ?? '')
      : ''
  );
  const sourceSibling = availableSiblings.find((q) => q.key === sourceKey) ?? null;
  const sourceType = sourceSibling
    ? toAdminQuestionType(sourceSibling.questionType)
    : null;

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'options',
  });

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }

    const query = (labelValue || '').trim();
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await suggestQuestions(query, initialData?.id);
        if (cancelled) return;

        if (result.success) {
          setSuggestions(result.suggestions);
          setShowSuggestions(result.suggestions.length > 0);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [labelValue, initialData?.id]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!labelWrapRef.current?.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const visibilityValue = String(
    visibility && typeof visibility === 'object' && visibility !== null && 'value' in visibility
      ? ((visibility as { value?: unknown }).value ?? '')
      : ''
  );

  const setVisibilityEnabled = (enabled: boolean) => {
    if (!enabled) {
      form.setValue('visibility', null, { shouldDirty: true, shouldValidate: false });
      return;
    }

    const first = availableSiblings[0];
    form.setValue(
      'visibility',
      {
        enabled: true,
        sourceQuestionKey: first?.key || '',
        operator: 'equals',
        value: defaultEqualsValueForSibling(first),
      },
      { shouldDirty: true, shouldValidate: false }
    );
  };

  const patchVisibility = (
    patch: Partial<{ sourceQuestionKey: string; value: string }>
  ) => {
    const raw = form.getValues('visibility');
    const current =
      raw && typeof raw === 'object' && 'enabled' in raw && raw.enabled === true
        ? {
            enabled: true as const,
            sourceQuestionKey:
              'sourceQuestionKey' in raw && typeof raw.sourceQuestionKey === 'string'
                ? raw.sourceQuestionKey
                : '',
            operator: 'equals' as const,
            value: 'value' in raw && typeof raw.value === 'string' ? raw.value : '',
          }
        : null;

    if (!current) return;

    form.setValue(
      'visibility',
      {
        ...current,
        ...patch,
        enabled: true,
        operator: 'equals',
      },
      { shouldDirty: true, shouldValidate: false }
    );
  };

  // If a select/boolean source is chosen but value is still empty, fill the first option.
  // Native <select> can look like "Yes" while the form value is still "".
  useEffect(() => {
    if (!visibilityEnabled || !sourceSibling) return;
    if (visibilityValue.trim()) return;
    const fallback = defaultEqualsValueForSibling(sourceSibling);
    if (!fallback) return;
    patchVisibility({ value: fallback });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync empty select values
  }, [visibilityEnabled, sourceKey, sourceType, visibilityValue, sourceSibling]);

  const applySuggestion = (suggestion: QuestionLabelSuggestion) => {
    skipNextSearchRef.current = true;
    form.setValue('label', suggestion.label, { shouldDirty: true, shouldValidate: true });
    form.setValue('description', suggestion.description || '', { shouldDirty: true });
    form.setValue('questionType', toAdminQuestionType(suggestion.questionType), {
      shouldDirty: true,
    });
    form.setValue('category', toAdminCategory(suggestion.category), { shouldDirty: true });
    form.setValue('required', suggestion.required ?? true, { shouldDirty: true });
    form.setValue(
      'visibility',
      adaptVisibilityForListing(suggestion.visibility, listingKeys),
      { shouldDirty: true }
    );
    replace(
      (suggestion.options || []).map((option) => ({
        label: option.label,
        value: crypto.randomUUID(),
      }))
    );
    setSuggestions([]);
    setShowSuggestions(false);
  };

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

  const onInvalid = (errors: typeof form.formState.errors) => {
    const visibilityError = errors.visibility;
    let message = 'Please fix the highlighted fields and try again.';

    if (visibilityError) {
      if (typeof visibilityError.message === 'string' && visibilityError.message) {
        message = visibilityError.message;
      } else if (
        typeof visibilityError === 'object' &&
        visibilityError &&
        'value' in visibilityError &&
        visibilityError.value &&
        typeof visibilityError.value === 'object' &&
        'message' in visibilityError.value
      ) {
        message = String(visibilityError.value.message || message);
      } else if (
        typeof visibilityError === 'object' &&
        visibilityError &&
        'sourceQuestionKey' in visibilityError &&
        visibilityError.sourceQuestionKey &&
        typeof visibilityError.sourceQuestionKey === 'object' &&
        'message' in visibilityError.sourceQuestionKey
      ) {
        message = String(visibilityError.sourceQuestionKey.message || message);
      } else {
        message = 'Complete the visibility rule (question + equals value), or turn it off.';
      }
    } else if (errors.label?.message) {
      message = errors.label.message;
    } else if (errors.options) {
      message = 'Dropdown questions need at least one option.';
    } else if (errors.category?.message) {
      message = errors.category.message;
    }

    alert(message);
  };

  const visibilityFieldError = (() => {
    const err = form.formState.errors.visibility;
    if (!err) return undefined;
    if (typeof err.message === 'string' && err.message) return err.message;
    if (typeof err === 'object' && err && 'value' in err) {
      const valueErr = err.value as { message?: string } | undefined;
      if (valueErr?.message) return valueErr.message;
    }
    if (typeof err === 'object' && err && 'sourceQuestionKey' in err) {
      const sourceErr = err.sourceQuestionKey as { message?: string } | undefined;
      if (sourceErr?.message) return sourceErr.message;
    }
    return 'Complete the visibility rule or turn it off.';
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-elevated max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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

        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="p-6">
          <div className="space-y-6">
            <div ref={labelWrapRef} className="relative">
              <Input
                label="Question Label"
                placeholder="e.g., What is your flight number?"
                helperText={
                  isSearching
                    ? 'Searching existing questions…'
                    : 'This is what users will see. Matching questions from all listings appear as you type.'
                }
                error={form.formState.errors.label?.message}
                autoComplete="off"
                {...form.register('label')}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
              />

              {showSuggestions && suggestions.length > 0 && (
                <ul
                  className="absolute z-20 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-2xl border border-ash-divider bg-white shadow-elevated"
                  role="listbox"
                  aria-label="Matching questions"
                >
                  {suggestions.map((suggestion) => (
                    <li key={suggestion.id}>
                      <button
                        type="button"
                        role="option"
                        className="w-full text-left px-4 py-3 hover:bg-sky-wash/50 transition-colors border-b border-ash-divider last:border-b-0"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applySuggestion(suggestion)}
                      >
                        <span className="block text-sm font-medium text-portrait-ink">
                          {suggestion.label}
                        </span>
                        <span className="block text-xs text-slate-helper mt-0.5">
                          {questionCategoryLabel(suggestion.category || 'other')}
                          {' · '}
                          {suggestion.questionType === 'select'
                            ? 'dropdown'
                            : suggestion.questionType}
                          {suggestion.required ? ' · Required' : ' · Optional'}
                          {(suggestion.questionType === 'dropdown' ||
                            suggestion.questionType === 'select') &&
                          suggestion.options?.length
                            ? ` · ${suggestion.options.length} options`
                            : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

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

            <Select
              label="Question Type"
              options={[
                { value: 'text', label: 'Text Input' },
                { value: 'date', label: 'Date Picker' },
                { value: 'dropdown', label: 'Dropdown' },
                { value: 'boolean', label: 'Yes/No Toggle' },
              ]}
              {...form.register('questionType')}
            />

            <Select
              label="Category"
              helperText="Groups this question under a section on the applicant form"
              options={QUESTION_CATEGORIES.map((category) => ({
                value: category.value,
                label: category.label,
              }))}
              error={form.formState.errors.category?.message}
              {...form.register('category')}
            />

            <Checkbox
              label="Required"
              description="User must answer this question to proceed"
              checked={!!form.watch('required')}
              onChange={(checked) => form.setValue('required', checked)}
            />

            <div className="p-4 bg-sky-wash/30 rounded-2xl space-y-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-portrait-ink">
                      Show only when…
                    </p>
                    <p className="text-xs text-slate-helper mt-0.5">
                      {availableSiblings.length === 0
                        ? 'Add another question first to use conditional visibility'
                        : 'Hide this field until another question equals a chosen value'}
                    </p>
                  </div>
                  <Toggle
                    enabled={visibilityEnabled}
                    onChange={setVisibilityEnabled}
                    disabled={availableSiblings.length === 0}
                    className="shrink-0"
                  />
                </div>
              </div>

              {visibilityEnabled && (
                <div className="space-y-4 pt-1">
                  <Select
                    label="When this question"
                    options={availableSiblings.map((sibling) => ({
                      value: sibling.key,
                      label: sibling.label,
                    }))}
                    value={sourceKey}
                    onChange={(event) => {
                      const nextKey = event.target.value;
                      const sibling = availableSiblings.find((item) => item.key === nextKey);
                      patchVisibility({
                        sourceQuestionKey: nextKey,
                        value: defaultEqualsValueForSibling(sibling),
                      });
                    }}
                  />

                  <p className="text-sm font-medium text-portrait-ink">Equals</p>

                  {sourceType === 'dropdown' && (
                    <Select
                      label="Value"
                      options={(sourceSibling?.options || []).map((option) => ({
                        value: option.value,
                        label: option.label,
                      }))}
                      value={visibilityValue}
                      onChange={(event) =>
                        patchVisibility({ value: event.target.value })
                      }
                      error={
                        typeof form.formState.errors.visibility === 'object' &&
                        form.formState.errors.visibility &&
                        'value' in form.formState.errors.visibility
                          ? String(
                              (form.formState.errors.visibility as { value?: { message?: string } })
                                .value?.message || ''
                            ) || undefined
                          : undefined
                      }
                    />
                  )}

                  {sourceType === 'boolean' && (
                    <Select
                      label="Value"
                      options={[
                        { value: 'true', label: 'Yes' },
                        { value: 'false', label: 'No' },
                      ]}
                      value={visibilityValue}
                      onChange={(event) =>
                        patchVisibility({ value: event.target.value })
                      }
                    />
                  )}

                  {sourceType === 'date' && (
                    <Input
                      label="Value"
                      type="date"
                      value={visibilityValue}
                      onChange={(event) =>
                        patchVisibility({ value: event.target.value })
                      }
                    />
                  )}

                  {(sourceType === 'text' || !sourceType) && (
                    <Input
                      label="Value"
                      placeholder="Exact answer to match"
                      value={visibilityValue}
                      onChange={(event) =>
                        patchVisibility({ value: event.target.value })
                      }
                      error={visibilityFieldError}
                    />
                  )}

                  {sourceType && sourceType !== 'text' && visibilityFieldError && (
                    <p className="text-sm text-red-600">{visibilityFieldError}</p>
                  )}
                </div>
              )}
            </div>

            {showOptions && (
              <div className="p-4 bg-mint-wash/30 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-portrait-ink">Dropdown Options</h4>
                  <Button
                    type="button"
                    onClick={() => append({ label: '', value: crypto.randomUUID() })}
                    variant="secondary"
                    size="sm"
                    className="flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Option
                  </Button>
                </div>

                {fields.length === 0 && (
                  <p className="text-sm text-slate-helper">
                    No options added yet. Click &quot;Add Option&quot; to get started.
                  </p>
                )}

                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-3 items-start">
                    <div className="flex-1">
                      <Input
                        label={index === 0 ? 'Option label' : ''}
                        placeholder="e.g., Engineer"
                        error={form.formState.errors.options?.[index]?.label?.message}
                        {...form.register(`options.${index}.label`)}
                      />
                      <input type="hidden" {...form.register(`options.${index}.value`)} />
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
          </div>

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
