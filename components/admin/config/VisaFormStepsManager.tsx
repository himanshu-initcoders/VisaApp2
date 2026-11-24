'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { QuestionCard } from './QuestionCard';
import { QuestionFormModal } from './QuestionFormModal';
import {
  FileText,
  GripVertical,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  visaFormStepSchema,
  type VisaFormStepInput,
} from '@/lib/validations/config';
import {
  createVisaFormStep,
  updateVisaFormStep,
  deleteVisaFormStep,
  reorderVisaFormSteps,
  deleteQuestion,
  reorderVisaStepQuestions,
  publishFormVersion,
} from '@/app/(admin)/admin/config/visa-listings/actions';
import {
  isLockedOcrSystemKey,
  type VisaFormStepKind,
} from '@/lib/apply/visaSystemFields';
import type { DocumentConditions } from '@/lib/document-conditions';
import type { QuestionVisibility } from '@/lib/question-visibility';

type QuestionRow = {
  id: string;
  key: string;
  stepId: string;
  systemKey?: string | null;
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
  required: boolean | null;
  options: Array<{ label: string; value: string }> | null;
  visibility?: QuestionVisibility;
  documentConditions?: DocumentConditions;
  sortOrder: number | null;
  requiredDoc?: string | null;
  extraInfo?: string | null;
  sourceUrl?: string | null;
  catalogQuestionId?: string | null;
};

type StepRow = {
  id: string;
  title: string;
  description: string | null;
  kind: VisaFormStepKind;
  sortOrder: number;
  questions: QuestionRow[];
};

interface VisaFormStepsManagerProps {
  listingId: string;
  productName?: string;
  initialSteps: StepRow[];
  catalog: Array<{ value: string; label: string }>;
  attachedDocumentTypes: string[];
  latestVersion?: number | null;
  latestPublishedAt?: string | null;
}

function SortableStepChip({
  step,
  active,
  onSelect,
  disableDrag,
}: {
  step: StepRow;
  active: boolean;
  onSelect: () => void;
  disableDrag?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: step.id, disabled: disableDrag });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 ${
        active
          ? 'border-portrait-ink bg-sky-wash'
          : 'border-ash-divider bg-white hover:bg-fog-edge/40'
      }`}
    >
      {!disableDrag ? (
        <button
          type="button"
          className="shrink-0 text-slate-helper"
          aria-label="Drag to reorder step"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : (
        <span className="shrink-0 w-4" aria-hidden />
      )}
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onSelect}
      >
        <span className="block truncate text-sm font-medium text-portrait-ink">
          {step.title}
        </span>
        <span className="block text-xs text-slate-helper">
          {step.kind === 'ocr'
            ? 'OCR · '
            : step.kind === 'trip'
              ? 'Trip · '
              : ''}
          {step.questions.length} question
          {step.questions.length !== 1 ? 's' : ''}
        </span>
      </button>
    </div>
  );
}

export function VisaFormStepsManager({
  listingId,
  productName,
  initialSteps,
  catalog,
  attachedDocumentTypes,
  latestVersion,
}: VisaFormStepsManagerProps) {
  const router = useRouter();
  const [steps, setSteps] = useState(initialSteps);
  const [activeStepId, setActiveStepId] = useState<string | null>(
    initialSteps[0]?.id ?? null
  );
  const [showStepModal, setShowStepModal] = useState(false);
  const [editingStep, setEditingStep] = useState<StepRow | null>(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionRow | null>(
    null
  );
  const [deletingStepId, setDeletingStepId] = useState<string | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(
    null
  );
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);
  useEffect(() => {
    setSteps(initialSteps);
    if (
      activeStepId &&
      !initialSteps.some((s) => s.id === activeStepId) &&
      initialSteps[0]
    ) {
      setActiveStepId(initialSteps[0].id);
    }
    if (!activeStepId && initialSteps[0]) {
      setActiveStepId(initialSteps[0].id);
    }
  }, [initialSteps]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeStep = useMemo(
    () => steps.find((s) => s.id === activeStepId) ?? null,
    [steps, activeStepId]
  );

  const allQuestions = useMemo(
    () => steps.flatMap((step) => step.questions),
    [steps]
  );

  const stepOptions = useMemo(
    () => steps.map((step) => ({ value: step.id, label: step.title })),
    [steps]
  );

  const stepForm = useForm<VisaFormStepInput>({
    resolver: zodResolver(visaFormStepSchema),
    defaultValues: { title: '', description: '' },
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const openCreateStep = () => {
    setEditingStep(null);
    stepForm.reset({ title: '', description: '' });
    setShowStepModal(true);
  };

  const openEditStep = (step: StepRow) => {
    setEditingStep(step);
    stepForm.reset({
      title: step.title,
      description: step.description || '',
    });
    setShowStepModal(true);
  };

  const saveStep = async (data: VisaFormStepInput) => {
    const result = editingStep
      ? await updateVisaFormStep(editingStep.id, data)
      : await createVisaFormStep(listingId, data);
    if (result.success) {
      setShowStepModal(false);
      router.refresh();
    } else {
      alert(result.error || 'Failed to save step');
    }
  };

  const openCreateQuestion = () => {
    if (!activeStepId) return;
    setEditingQuestion(null);
    setShowQuestionModal(true);
  };

  const openEditQuestion = (question: QuestionRow) => {
    setEditingQuestion(question);
    setShowQuestionModal(true);
  };

  const handleStepDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    if (steps[oldIndex]?.kind === 'ocr' || steps[newIndex]?.kind === 'ocr') {
      return;
    }
    const reordered = arrayMove(steps, oldIndex, newIndex);
    const ocr = reordered.find((s) => s.kind === 'ocr');
    const withoutOcr = reordered.filter((s) => s.kind !== 'ocr');
    const forced = ocr ? [ocr, ...withoutOcr] : reordered;
    setSteps(forced);
    await reorderVisaFormSteps(
      listingId,
      forced.map((s) => s.id)
    );
  };

  const handleQuestionDragEnd = async (event: DragEndEvent) => {
    if (!activeStep) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const qs = activeStep.questions;
    const oldIndex = qs.findIndex((q) => q.id === active.id);
    const newIndex = qs.findIndex((q) => q.id === over.id);
    const reordered = arrayMove(qs, oldIndex, newIndex);
    setSteps((prev) =>
      prev.map((s) =>
        s.id === activeStep.id ? { ...s, questions: reordered } : s
      )
    );
    await reorderVisaStepQuestions(
      activeStep.id,
      reordered.map((q) => q.id)
    );
  };

  const confirmDeleteStep = async () => {
    if (!deletingStepId) return;
    const result = await deleteVisaFormStep(deletingStepId);
    if (result.success) {
      setDeletingStepId(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete step');
    }
  };

  const confirmDeleteQuestion = async () => {
    if (!deletingQuestionId) return;
    const result = await deleteQuestion(deletingQuestionId);
    if (result.success) {
      setDeletingQuestionId(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete question');
    }
  };

  const handlePublish = async () => {
    setPublishMessage(null);
    const result = await publishFormVersion(listingId);
    if (result.success) {
      setPublishMessage(result.message || 'Published');
      router.refresh();
    } else {
      alert(result.error || 'Failed to publish');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1
            className="text-[44px] font-medium leading-tight tracking-tight text-portrait-ink"
            style={{ fontFamily: 'Basier Circle', letterSpacing: '-1.15px' }}
          >
            Form Builder
          </h1>
          <p className="mt-2 text-base text-slate-helper">
            {productName
              ? `Customize Personal details, Trip details, and extra steps for ${productName}.`
              : 'Customize Personal details, Trip details, and extra steps.'}{' '}
            The first step is always OCR. First name, last name, and passport
            number cannot be removed.
          </p>
          <p className="mt-1 text-sm text-slate-helper">
            Published version:{' '}
            <span className="font-medium text-portrait-ink">
              {latestVersion != null ? `v${latestVersion}` : 'none yet'}
            </span>
          </p>
          {publishMessage && (
            <p className="mt-2 text-sm text-green-700">{publishMessage}</p>
          )}
        </div>
        <Button
          type="button"
          variant="primary"
          className="shrink-0 self-start"
          onClick={handlePublish}
          disabled={steps.length === 0}
        >
          Publish form version
        </Button>
      </div>

      {steps.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="No form steps yet"
          description="Personal details and Trip details are seeded automatically for new listings."
          action={{ label: 'Add first step', onClick: openCreateStep }}
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-ash-divider bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-helper">
                Steps / tabs
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={openCreateStep}>
                <span className="inline-flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  Add
                </span>
              </Button>
            </div>
            {isMounted ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleStepDragEnd}
              >
                <SortableContext
                  items={steps.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {steps.map((step) => (
                      <SortableStepChip
                        key={step.id}
                        step={step}
                        active={step.id === activeStepId}
                        onSelect={() => setActiveStepId(step.id)}
                        disableDrag={step.kind === 'ocr'}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="space-y-2">
                {steps.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStepId(step.id)}
                    className={`w-full rounded-2xl border px-3 py-2 text-left text-sm ${
                      step.id === activeStepId
                        ? 'border-portrait-ink bg-sky-wash'
                        : 'border-ash-divider'
                    }`}
                  >
                    {step.title}
                  </button>
                ))}
              </div>
            )}
          </aside>

          {activeStep && (
            <section className="rounded-3xl border border-ash-divider bg-white">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ash-divider px-5 py-4">
                <div className="min-w-0">
                  <h2 className="text-xl font-medium text-portrait-ink">
                    {activeStep.title}
                  </h2>
                  {activeStep.description ? (
                    <p className="mt-1 text-sm text-slate-helper">
                      {activeStep.description}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-helper">
                      {activeStep.kind === 'ocr'
                        ? 'OCR fills these fields from the passport scan. You can rename labels or remove optional fields.'
                        : 'Questions in this applicant tab'}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditStep(activeStep)}
                  >
                    Edit step
                  </Button>
                  {activeStep.kind !== 'ocr' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingStepId(activeStep.id)}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Trash2 className="h-3.5 w-3.5 shrink-0" />
                        Delete
                      </span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={openCreateQuestion}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5 shrink-0" />
                      Add question
                    </span>
                  </Button>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <p className="text-sm text-slate-helper">
                  {activeStep.questions.length} question
                  {activeStep.questions.length !== 1 ? 's' : ''}
                </p>

                {activeStep.questions.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="h-12 w-12" />}
                    title="No questions in this step"
                    description="Add required fields, options, show-if rules, and conditional documents."
                    action={{
                      label: 'Add question',
                      onClick: openCreateQuestion,
                    }}
                  />
                ) : isMounted ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleQuestionDragEnd}
                  >
                    <SortableContext
                      items={activeStep.questions.map((q) => q.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {activeStep.questions.map((question, index) => (
                          <QuestionCard
                            key={question.id}
                            question={question}
                            index={index}
                            groupLabel={activeStep.title}
                            systemBadge={
                              question.systemKey
                                ? activeStep.kind === 'ocr'
                                  ? 'OCR'
                                  : 'System'
                                : null
                            }
                            disableDelete={isLockedOcrSystemKey(
                              question.systemKey
                            )}
                            onEdit={() => openEditQuestion(question)}
                            onDelete={() => setDeletingQuestionId(question.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className="space-y-3">
                    {activeStep.questions.map((question, index) => (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        index={index}
                        groupLabel={activeStep.title}
                        systemBadge={
                          question.systemKey
                            ? activeStep.kind === 'ocr'
                              ? 'OCR'
                              : 'System'
                            : null
                        }
                        disableDelete={isLockedOcrSystemKey(question.systemKey)}
                        onEdit={() => openEditQuestion(question)}
                        onDelete={() => setDeletingQuestionId(question.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {showStepModal && (
        <StepModal
          title={editingStep ? 'Edit step' : 'Add step'}
          form={stepForm}
          onClose={() => setShowStepModal(false)}
          onSubmit={saveStep}
        />
      )}

      {showQuestionModal && (
        <QuestionFormModal
          variant="visa"
          processId={listingId}
          initialData={
            editingQuestion
              ? {
                  id: editingQuestion.id,
                  visaListingId: listingId,
                  key: editingQuestion.key,
                  label: editingQuestion.label,
                  description: editingQuestion.description,
                  questionType: editingQuestion.questionType,
                  stepId: editingQuestion.stepId,
                  category: 'other',
                  required: editingQuestion.required ?? true,
                  options: editingQuestion.options ?? [],
                  visibility: editingQuestion.visibility,
                  documentConditions: editingQuestion.documentConditions,
                  requiredDoc: editingQuestion.requiredDoc ?? null,
                  extraInfo: editingQuestion.extraInfo ?? null,
                  sourceUrl: editingQuestion.sourceUrl ?? null,
                  sortOrder: editingQuestion.sortOrder,
                  catalogQuestionId: editingQuestion.catalogQuestionId ?? null,
                  createdAt: new Date(),
                }
              : null
          }
          siblingQuestions={allQuestions.map((q) => ({
            id: q.id,
            key: q.key,
            label: q.label,
            questionType: q.questionType,
            options: q.options,
            visibility: q.visibility,
          }))}
          documentCatalog={catalog}
          attachedDocumentTypes={attachedDocumentTypes}
          stepOptions={stepOptions}
          defaultStepId={activeStepId || undefined}
          onClose={() => {
            setShowQuestionModal(false);
            setEditingQuestion(null);
          }}
          onSuccess={() => {
            setShowQuestionModal(false);
            setEditingQuestion(null);
            router.refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={deletingStepId !== null}
        onClose={() => setDeletingStepId(null)}
        onConfirm={confirmDeleteStep}
        title="Delete step?"
        message="All questions in this step will be deleted."
        confirmText="Delete step"
        destructive
      />
      <ConfirmDialog
        open={deletingQuestionId !== null}
        onClose={() => setDeletingQuestionId(null)}
        onConfirm={confirmDeleteQuestion}
        title="Delete question?"
        message="This question will be removed from the form."
        confirmText="Delete"
        destructive
      />
    </div>
  );
}

function StepModal({
  title,
  form,
  onClose,
  onSubmit,
}: {
  title: string;
  form: ReturnType<typeof useForm<VisaFormStepInput>>;
  onClose: () => void;
  onSubmit: (data: VisaFormStepInput) => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-elevated">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-medium text-portrait-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 transition-colors hover:bg-slate-helper/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Step title"
            helperText="Shown as a tab to the applicant"
            error={form.formState.errors.title?.message}
            {...form.register('title')}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-portrait-ink">
              Helper text (optional)
            </label>
            <textarea
              rows={3}
              className="w-full rounded-2xl border border-ash-divider px-4 py-3 text-sm"
              placeholder="Short instruction for this tab"
              {...form.register('description')}
            />
          </div>
          <Button type="submit" variant="primary" className="w-full">
            Save step
          </Button>
        </form>
      </div>
    </div>,
    document.body
  );
}
