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
  type QuestionVisibilityOperator,
} from '@/lib/question-visibility';
import {
  adaptDocumentConditionsForListing,
  isDocumentConditionsDraftEnabled,
  normalizeDocumentConditions,
  type DocumentConditionOperator,
  type DocumentConditions,
} from '@/lib/document-conditions';
import { X, Plus, Trash2 } from 'lucide-react';
import { z } from 'zod';

type QuestionFormValues = z.input<typeof additionalQuestionSchema>;

type QuestionLabelSuggestion = {
  id: string;
  label: string;
  description: string | null;
  questionType:
    | 'text'
    | 'date'
    | 'select'
    | 'dropdown'
    | 'file'
    | 'flight'
    | 'boolean'
    | 'checkbox'
    | 'radio';
  category: string;
  required: boolean | null;
  options: Array<{ label: string; value: string }> | null;
  visibility?: QuestionVisibility;
  documentConditions?: DocumentConditions;
};

type AdminQuestionType = 'text' | 'date' | 'dropdown' | 'boolean' | 'checkbox' | 'radio';

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
  if (type === 'checkbox') return 'checkbox';
  if (type === 'radio') return 'radio';
  if (type === 'dropdown' || type === 'select') return 'dropdown';
  return 'text';
}

function questionTypeLabel(type: string): string {
  if (type === 'select') return 'dropdown';
  if (type === 'radio') return 'radio';
  if (type === 'checkbox') return 'checkbox';
  if (type === 'boolean') return 'boolean';
  return type;
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
  if (type === 'dropdown' || type === 'radio' || type === 'checkbox') {
    return sibling.options?.[0]?.value ?? '';
  }
  return '';
}

/** Default equals-value for this question's own type (document conditions). */
function defaultEqualsValueForSelf(
  questionType: AdminQuestionType,
  options: Array<{ label: string; value: string }> | undefined
): string {
  if (questionType === 'boolean') return 'true';
  if (questionType === 'dropdown' || questionType === 'radio' || questionType === 'checkbox') {
    return options?.[0]?.value ?? '';
  }
  return '';
}

interface Question {
  id: string;
  visaListingId: string;
  key: string;
  label: string;
  description: string | null;
  questionType:
    | 'text'
    | 'date'
    | 'select'
    | 'dropdown'
    | 'file'
    | 'flight'
    | 'boolean'
    | 'checkbox'
    | 'radio';
  category?: string | null;
  required: boolean | null;
  familyEnabled: boolean | null;
  onlyB2b: boolean | null;
  extraInfo: string | null;
  requiredDoc: string | null;
  sourceUrl: string | null;
  options: Array<{ label: string; value: string }> | null;
  visibility?: QuestionVisibility;
  documentConditions?: DocumentConditions;
  sortOrder: number | null;
  createdAt: Date;
}

interface QuestionFormModalProps {
  processId: string;
  initialData: Question | null;
  siblingQuestions: SiblingQuestion[];
  documentCatalog: Array<{ value: string; label: string }>;
  attachedDocumentTypes: string[];
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
  documentCatalog,
  attachedDocumentTypes,
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

  const attachedSet = useMemo(
    () => new Set(attachedDocumentTypes),
    [attachedDocumentTypes]
  );

  const initialVisibility = normalizeQuestionVisibility(initialData?.visibility);
  const initialDocumentConditions = normalizeDocumentConditions(
    initialData?.documentConditions
  );

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
          documentConditions: initialDocumentConditions,
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
          documentConditions: null,
        },
  });

  const questionType = form.watch('questionType');
  const labelValue = form.watch('label');
  const visibility = form.watch('visibility');
  const documentConditions = form.watch('documentConditions');
  const watchedOptions = form.watch('options');
  const visibilityEnabled = isVisibilityDraftEnabled(visibility);
  const documentConditionsEnabled = isDocumentConditionsDraftEnabled(documentConditions);
  const showOptions =
    questionType === 'dropdown' ||
    questionType === 'checkbox' ||
    questionType === 'radio';

  const sourceKey = String(
    visibility && typeof visibility === 'object' && visibility !== null && 'sourceQuestionKey' in visibility
      ? ((visibility as { sourceQuestionKey?: unknown }).sourceQuestionKey ?? '')
      : ''
  );
  const visibilityOperator: QuestionVisibilityOperator = (() => {
    if (
      visibility &&
      typeof visibility === 'object' &&
      visibility !== null &&
      'operator' in visibility &&
      typeof (visibility as { operator?: unknown }).operator === 'string'
    ) {
      const op = (visibility as { operator: string }).operator;
      if (op === 'is_empty' || op === 'is_filled' || op === 'equals') return op;
    }
    return 'equals';
  })();
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
    patch: Partial<{
      sourceQuestionKey: string;
      value: string;
      operator: QuestionVisibilityOperator;
    }>
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
            operator: ((): QuestionVisibilityOperator => {
              if ('operator' in raw && typeof raw.operator === 'string') {
                if (
                  raw.operator === 'is_empty' ||
                  raw.operator === 'is_filled' ||
                  raw.operator === 'equals'
                ) {
                  return raw.operator;
                }
              }
              return 'equals';
            })(),
            value: 'value' in raw && typeof raw.value === 'string' ? raw.value : '',
          }
        : null;

    if (!current) return;

    const nextOperator = patch.operator ?? current.operator;
    const nextSourceKey = patch.sourceQuestionKey ?? current.sourceQuestionKey;
    let nextValue = patch.value !== undefined ? patch.value : current.value;

    if (nextOperator !== 'equals') {
      nextValue = '';
    } else if (patch.operator === 'equals' && !nextValue.trim()) {
      const sibling = availableSiblings.find((item) => item.key === nextSourceKey);
      nextValue = defaultEqualsValueForSibling(sibling);
    }

    form.setValue(
      'visibility',
      {
        enabled: true,
        sourceQuestionKey: nextSourceKey,
        operator: nextOperator,
        value: nextValue,
      },
      { shouldDirty: true, shouldValidate: false }
    );
  };

  // If equals mode + select/boolean source is chosen but value is still empty, fill the first option.
  // Native <select> can look like "Yes" while the form value is still "".
  useEffect(() => {
    if (!visibilityEnabled || visibilityOperator !== 'equals' || !sourceSibling) return;
    if (visibilityValue.trim()) return;
    const fallback = defaultEqualsValueForSibling(sourceSibling);
    if (!fallback) return;
    patchVisibility({ value: fallback });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync empty select values
  }, [
    visibilityEnabled,
    visibilityOperator,
    sourceKey,
    sourceType,
    visibilityValue,
    sourceSibling,
  ]);

  const documentConditionsOperator: DocumentConditionOperator = (() => {
    if (
      documentConditions &&
      typeof documentConditions === 'object' &&
      documentConditions !== null &&
      'operator' in documentConditions &&
      typeof (documentConditions as { operator?: unknown }).operator === 'string'
    ) {
      const op = (documentConditions as { operator: string }).operator;
      if (op === 'is_empty' || op === 'is_filled' || op === 'equals') return op;
    }
    return 'equals';
  })();

  const documentConditionsValue = String(
    documentConditions &&
      typeof documentConditions === 'object' &&
      documentConditions !== null &&
      'value' in documentConditions
      ? ((documentConditions as { value?: unknown }).value ?? '')
      : ''
  );

  const selectedDocumentItems: Array<{ documentType: string; required: boolean }> = (() => {
    if (
      !documentConditions ||
      typeof documentConditions !== 'object' ||
      !('documents' in documentConditions) ||
      !Array.isArray((documentConditions as { documents?: unknown }).documents)
    ) {
      return [];
    }
    return (
      documentConditions as {
        documents: Array<{ documentType?: string; required?: boolean }>;
      }
    ).documents
      .filter((d) => typeof d.documentType === 'string' && d.documentType.trim())
      .map((d) => ({
        documentType: String(d.documentType),
        required: d.required !== false,
      }));
  })();

  const selectedDocumentTypeSet = useMemo(
    () => new Set(selectedDocumentItems.map((d) => d.documentType)),
    [selectedDocumentItems]
  );

  const setDocumentConditionsEnabled = (enabled: boolean) => {
    if (!enabled) {
      form.setValue('documentConditions', null, { shouldDirty: true, shouldValidate: false });
      return;
    }

    const type = toAdminQuestionType(questionType);
    const options = (watchedOptions || []).map((o) => ({
      label: o.label,
      value: o.value || '',
    }));

    form.setValue(
      'documentConditions',
      {
        enabled: true,
        operator: 'equals',
        value: defaultEqualsValueForSelf(type, options),
        documents: [],
      },
      { shouldDirty: true, shouldValidate: false }
    );
  };

  const patchDocumentConditions = (
    patch: Partial<{
      operator: DocumentConditionOperator;
      value: string;
      documents: Array<{ documentType: string; required: boolean }>;
    }>
  ) => {
    const raw = form.getValues('documentConditions');
    const current =
      raw && typeof raw === 'object' && 'enabled' in raw && raw.enabled === true
        ? {
            enabled: true as const,
            operator: ((): DocumentConditionOperator => {
              if ('operator' in raw && typeof raw.operator === 'string') {
                if (
                  raw.operator === 'is_empty' ||
                  raw.operator === 'is_filled' ||
                  raw.operator === 'equals'
                ) {
                  return raw.operator;
                }
              }
              return 'equals';
            })(),
            value: 'value' in raw && typeof raw.value === 'string' ? raw.value : '',
            documents: Array.isArray(
              (raw as { documents?: Array<{ documentType: string; required?: boolean }> })
                .documents
            )
              ? (
                  raw as {
                    documents: Array<{ documentType: string; required?: boolean }>;
                  }
                ).documents.map((d) => ({
                  documentType: d.documentType,
                  required: d.required !== false,
                }))
              : [],
          }
        : null;

    if (!current) return;

    const nextOperator = patch.operator ?? current.operator;
    let nextValue = patch.value !== undefined ? patch.value : current.value;

    if (nextOperator !== 'equals') {
      nextValue = '';
    } else if (patch.operator === 'equals' && !nextValue.trim()) {
      nextValue = defaultEqualsValueForSelf(
        toAdminQuestionType(questionType),
        (watchedOptions || []).map((o) => ({ label: o.label, value: o.value || '' }))
      );
    }

    form.setValue(
      'documentConditions',
      {
        enabled: true,
        operator: nextOperator,
        value: nextValue,
        documents: patch.documents ?? current.documents,
      },
      { shouldDirty: true, shouldValidate: false }
    );
  };

  const toggleDocumentType = (documentType: string, checked: boolean) => {
    const current = selectedDocumentItems;
    if (checked) {
      if (current.some((d) => d.documentType === documentType)) return;
      // Always required when shown (optional-when-shown toggle is disabled for now).
      patchDocumentConditions({
        documents: [...current, { documentType, required: true }],
      });
      return;
    }
    patchDocumentConditions({
      documents: current.filter((d) => d.documentType !== documentType),
    });
  };

  // Optional-when-shown toggle disabled for now — always required.
  // const setDocumentTypeRequired = (documentType: string, required: boolean) => {
  //   patchDocumentConditions({
  //     documents: selectedDocumentItems.map((d) =>
  //       d.documentType === documentType ? { ...d, required } : d
  //     ),
  //   });
  // };

  // Keep equals value filled when this question's type/options change.
  useEffect(() => {
    if (!documentConditionsEnabled || documentConditionsOperator !== 'equals') return;
    if (documentConditionsValue.trim()) return;
    const fallback = defaultEqualsValueForSelf(
      toAdminQuestionType(questionType),
      (watchedOptions || []).map((o) => ({ label: o.label, value: o.value || '' }))
    );
    if (!fallback) return;
    patchDocumentConditions({ value: fallback });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync empty equals values
  }, [
    documentConditionsEnabled,
    documentConditionsOperator,
    documentConditionsValue,
    questionType,
    watchedOptions,
  ]);

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
    form.setValue(
      'documentConditions',
      adaptDocumentConditionsForListing(suggestion.documentConditions),
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
        message = 'Complete the visibility rule (question + match mode), or turn it off.';
      }
    } else if (errors.documentConditions) {
      const docErr = errors.documentConditions;
      if (typeof docErr.message === 'string' && docErr.message) {
        message = docErr.message;
      } else if (
        typeof docErr === 'object' &&
        docErr &&
        'documents' in docErr &&
        docErr.documents &&
        typeof docErr.documents === 'object' &&
        'message' in docErr.documents
      ) {
        message = String(docErr.documents.message || message);
      } else if (
        typeof docErr === 'object' &&
        docErr &&
        'value' in docErr &&
        docErr.value &&
        typeof docErr.value === 'object' &&
        'message' in docErr.value
      ) {
        message = String(docErr.value.message || message);
      } else {
        message =
          'Complete the document condition (match value + at least one document), or turn it off.';
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
                          {questionTypeLabel(suggestion.questionType)}
                          {suggestion.required ? ' · Required' : ' · Optional'}
                          {(suggestion.questionType === 'dropdown' ||
                            suggestion.questionType === 'select' ||
                            suggestion.questionType === 'checkbox' ||
                            suggestion.questionType === 'radio') &&
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
                { value: 'radio', label: 'Radio button' },
                { value: 'checkbox', label: 'Checkbox' },
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
                        : 'Hide this field until another question matches the selected condition'}
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
                        value:
                          visibilityOperator === 'equals'
                            ? defaultEqualsValueForSibling(sibling)
                            : '',
                      });
                    }}
                  />

                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-portrait-ink">Match when</legend>
                    <div className="space-y-2">
                      {(
                        [
                          {
                            value: 'equals' as const,
                            label: 'Equals',
                            description: 'Source answer matches a specific value',
                          },
                          {
                            value: 'is_empty' as const,
                            label: 'Not filled / null',
                            description: 'Source answer is missing, blank, or empty',
                          },
                          {
                            value: 'is_filled' as const,
                            label: 'Any value',
                            description: 'Source answer has any filled value',
                          },
                        ] as const
                      ).map((option) => (
                        <label
                          key={option.value}
                          className="flex items-start gap-3 cursor-pointer rounded-2xl border border-fog-edge bg-white px-3 py-2.5"
                        >
                          <input
                            type="radio"
                            name="visibility-operator"
                            className="mt-1 h-4 w-4 accent-portrait-ink"
                            checked={visibilityOperator === option.value}
                            onChange={() => patchVisibility({ operator: option.value })}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-portrait-ink">
                              {option.label}
                            </span>
                            <span className="block text-xs text-slate-helper mt-0.5">
                              {option.description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {visibilityOperator === 'equals' && (
                    <>
                      {sourceType === 'dropdown' ||
                      sourceType === 'radio' ||
                      sourceType === 'checkbox' ? (
                        <Select
                          label="Value"
                          helperText={
                            sourceType === 'checkbox'
                              ? 'Shows when this option is among the selected checkboxes'
                              : undefined
                          }
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
                                  (
                                    form.formState.errors.visibility as {
                                      value?: { message?: string };
                                    }
                                  ).value?.message || ''
                                ) || undefined
                              : undefined
                          }
                        />
                      ) : null}

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
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-peach-wash/30 rounded-2xl space-y-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-portrait-ink">
                      Documents when…
                    </p>
                    <p className="text-xs text-slate-helper mt-0.5">
                      Show or require catalog documents when this question&apos;s answer
                      matches. Unattached types are added to the listing on save.
                    </p>
                  </div>
                  <Toggle
                    enabled={documentConditionsEnabled}
                    onChange={setDocumentConditionsEnabled}
                    disabled={documentCatalog.length === 0}
                    className="shrink-0"
                  />
                </div>
                {documentCatalog.length === 0 && (
                  <p className="text-xs text-slate-helper">
                    Add document types in the catalog first to use this option.
                  </p>
                )}
              </div>

              {documentConditionsEnabled && (
                <div className="space-y-4 pt-1">
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-portrait-ink">
                      When this answer
                    </legend>
                    <div className="space-y-2">
                      {(
                        [
                          {
                            value: 'equals' as const,
                            label: 'Equals',
                            description: 'Answer matches a specific value',
                          },
                          {
                            value: 'is_empty' as const,
                            label: 'Not filled / null',
                            description: 'Answer is missing, blank, or empty',
                          },
                          {
                            value: 'is_filled' as const,
                            label: 'Any value',
                            description: 'Answer has any filled value',
                          },
                        ] as const
                      ).map((option) => (
                        <label
                          key={option.value}
                          className="flex items-start gap-3 cursor-pointer rounded-2xl border border-fog-edge bg-white px-3 py-2.5"
                        >
                          <input
                            type="radio"
                            name="document-conditions-operator"
                            className="mt-1 h-4 w-4 accent-portrait-ink"
                            checked={documentConditionsOperator === option.value}
                            onChange={() =>
                              patchDocumentConditions({ operator: option.value })
                            }
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-portrait-ink">
                              {option.label}
                            </span>
                            <span className="block text-xs text-slate-helper mt-0.5">
                              {option.description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {documentConditionsOperator === 'equals' && (
                    <>
                      {questionType === 'dropdown' ||
                      questionType === 'radio' ||
                      questionType === 'checkbox' ? (
                        <Select
                          label="Value"
                          helperText={
                            questionType === 'checkbox'
                              ? 'Documents show when this option is among the selected checkboxes'
                              : undefined
                          }
                          options={(watchedOptions || [])
                            .filter((option) => option.label?.trim())
                            .map((option) => ({
                              value: option.value || option.label,
                              label: option.label,
                            }))}
                          value={documentConditionsValue}
                          onChange={(event) =>
                            patchDocumentConditions({ value: event.target.value })
                          }
                        />
                      ) : null}

                      {questionType === 'boolean' && (
                        <Select
                          label="Value"
                          options={[
                            { value: 'true', label: 'Yes' },
                            { value: 'false', label: 'No' },
                          ]}
                          value={documentConditionsValue}
                          onChange={(event) =>
                            patchDocumentConditions({ value: event.target.value })
                          }
                        />
                      )}

                      {questionType === 'date' && (
                        <Input
                          label="Value"
                          type="date"
                          value={documentConditionsValue}
                          onChange={(event) =>
                            patchDocumentConditions({ value: event.target.value })
                          }
                        />
                      )}

                      {questionType === 'text' && (
                        <Input
                          label="Value"
                          placeholder="Exact answer to match"
                          value={documentConditionsValue}
                          onChange={(event) =>
                            patchDocumentConditions({ value: event.target.value })
                          }
                        />
                      )}
                    </>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-portrait-ink">Document types</p>
                    <p className="text-xs text-slate-helper">
                      Select catalog types. Already on this listing stay attached; new ones
                      are attached on save.
                    </p>
                    <div className="max-h-56 overflow-y-auto space-y-2 rounded-2xl border border-fog-edge bg-white p-3">
                      {documentCatalog.map((doc) => {
                        const checked = selectedDocumentTypeSet.has(doc.value);
                        const alreadyAttached = attachedSet.has(doc.value);
                        return (
                          <div
                            key={doc.value}
                            className="flex flex-col gap-2 rounded-xl border border-fog-edge/60 px-3 py-2.5"
                          >
                            <label className="flex items-start gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 accent-portrait-ink"
                                checked={checked}
                                onChange={(event) =>
                                  toggleDocumentType(doc.value, event.target.checked)
                                }
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-portrait-ink">
                                  {doc.label}
                                </span>
                                <span className="block text-xs text-slate-helper mt-0.5">
                                  {doc.value}
                                  {alreadyAttached
                                    ? ' · already on listing'
                                    : ' · will attach on save'}
                                  {checked ? ' · required when shown' : ''}
                                </span>
                              </span>
                            </label>
                            {/* Optional-when-shown toggle disabled for now — always required.
                            {checked && (
                              <label className="ml-7 flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="h-3.5 w-3.5 accent-portrait-ink"
                                  checked={
                                    selectedDocumentItems.find(
                                      (d) => d.documentType === doc.value
                                    )?.required ?? true
                                  }
                                  onChange={(event) =>
                                    setDocumentTypeRequired(doc.value, event.target.checked)
                                  }
                                />
                                <span className="text-xs text-portrait-ink">
                                  Required when shown
                                </span>
                              </label>
                            )}
                            */}
                          </div>
                        );
                      })}
                    </div>
                    {form.formState.errors.documentConditions &&
                      typeof form.formState.errors.documentConditions === 'object' &&
                      'documents' in form.formState.errors.documentConditions && (
                        <p className="text-sm text-red-600">
                          {String(
                            (
                              form.formState.errors.documentConditions as {
                                documents?: { message?: string };
                              }
                            ).documents?.message || 'Select at least one document type'
                          )}
                        </p>
                      )}
                  </div>
                </div>
              )}
            </div>

            {showOptions && (
              <div className="p-4 bg-mint-wash/30 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-portrait-ink">
                    {questionType === 'radio'
                      ? 'Radio Options'
                      : questionType === 'checkbox'
                        ? 'Checkbox Options'
                        : 'Dropdown Options'}
                  </h4>
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
