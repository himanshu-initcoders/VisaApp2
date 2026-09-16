'use client';

import {
  UnderlineField,
  UnderlineSelect,
} from '@/components/apply/form/UnderlineField';
import type {
  ApplyTripQuestion,
  TravellerTripDetails,
} from '@/lib/apply/applicationForm';
import {
  groupApplyTripQuestions,
  parseCheckboxValues,
  stringifyCheckboxValues,
} from '@/lib/apply/applicationForm';
import {
  clearHiddenQuestionAnswers,
  getVisibleExtraQuestions,
} from '@/lib/question-visibility';

interface AdditionalQuestionsTabProps {
  trip: TravellerTripDetails;
  extraQuestions: ApplyTripQuestion[];
  onChange: (next: TravellerTripDetails) => void;
}

function ExtraQuestionField({
  question,
  value,
  onUpdate,
}: {
  question: ApplyTripQuestion;
  value: string;
  onUpdate: (next: string) => void;
}) {
  if (question.type === 'boolean') {
    return (
      <label className="flex items-start gap-3 sm:col-span-2">
        <input
          type="checkbox"
          checked={value === 'true'}
          onChange={(event) => onUpdate(event.target.checked ? 'true' : 'false')}
          className="mt-1 h-4 w-4 rounded border-ash"
        />
        <span>
          <span className="block text-sm font-medium text-portrait-ink">
            {question.label}
            {question.required && <span className="text-[#ff4940]"> *</span>}
          </span>
          {question.description && (
            <span className="mt-0.5 block text-xs text-slate-helper">
              {question.description}
            </span>
          )}
        </span>
      </label>
    );
  }

  if (question.type === 'radio') {
    return (
      <fieldset className="sm:col-span-2 space-y-3">
        <legend className="text-sm font-medium text-portrait-ink">
          {question.label}
          {question.required && <span className="text-[#ff4940]"> *</span>}
        </legend>
        {question.description && (
          <p className="text-xs text-slate-helper">{question.description}</p>
        )}
        <div className="space-y-2">
          {(question.options ?? []).map((option, index) => (
            <label
              key={`${question.id}-${option.value}-${index}`}
              className="flex items-center gap-3 rounded-2xl border border-ash px-4 py-3 cursor-pointer hover:bg-sky-wash/40"
            >
              <input
                type="radio"
                name={question.key}
                value={option.value}
                checked={value === option.value}
                onChange={() => onUpdate(option.value)}
                className="h-4 w-4 border-ash text-portrait-ink"
              />
              <span className="text-sm text-portrait-ink">{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (question.type === 'checkbox') {
    const selected = parseCheckboxValues(value);
    const toggle = (optionValue: string, checked: boolean) => {
      const next = checked
        ? [...selected, optionValue]
        : selected.filter((item) => item !== optionValue);
      onUpdate(stringifyCheckboxValues(next));
    };

    return (
      <fieldset className="sm:col-span-2 space-y-3">
        <legend className="text-sm font-medium text-portrait-ink">
          {question.label}
          {question.required && <span className="text-[#ff4940]"> *</span>}
        </legend>
        {question.description && (
          <p className="text-xs text-slate-helper">{question.description}</p>
        )}
        <div className="space-y-2">
          {(question.options ?? []).map((option, index) => {
            const isChecked = selected.includes(option.value);
            return (
              <label
                key={`${question.id}-${option.value}-${index}`}
                className="flex items-center gap-3 rounded-2xl border border-ash px-4 py-3 cursor-pointer hover:bg-sky-wash/40"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(event) => toggle(option.value, event.target.checked)}
                  className="h-4 w-4 rounded border-ash"
                />
                <span className="text-sm text-portrait-ink">{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (question.type === 'dropdown') {
    return (
      <UnderlineSelect
        label={question.label}
        required={question.required}
        value={value}
        onChange={onUpdate}
      >
        <option value="">Select</option>
        {(question.options ?? []).map((option, index) => (
          <option
            key={`${question.id}-${option.value}-${index}`}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </UnderlineSelect>
    );
  }

  return (
    <UnderlineField
      label={question.label}
      required={question.required}
      type={question.type === 'date' ? 'date' : 'text'}
      value={value}
      onChange={onUpdate}
    />
  );
}

export function AdditionalQuestionsTab({
  trip,
  extraQuestions,
  onChange,
}: AdditionalQuestionsTabProps) {
  const visibleQuestions = getVisibleExtraQuestions(extraQuestions, trip.extra);
  const questionGroups = groupApplyTripQuestions(visibleQuestions);

  const updateExtra = (key: string, next: string) => {
    const tentative = { ...trip.extra, [key]: next };
    const cleaned = clearHiddenQuestionAnswers(extraQuestions, tentative);
    onChange({ ...trip, extra: cleaned });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-basier text-xl text-portrait-ink">
          Additional questions
        </h2>
        <p className="mt-1 text-sm text-slate-helper">
          Answer the questions required for this visa listing.
        </p>
      </div>

      {questionGroups.length === 0 ? (
        <p className="text-sm text-slate-helper">No additional questions.</p>
      ) : (
        questionGroups.map((group) => (
          <div key={group.category} className="pt-2">
            <h3 className="font-basier text-lg text-portrait-ink">{group.label}</h3>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {group.questions.map((question) => {
                const value = trip.extra[question.key] ?? '';
                return (
                  <ExtraQuestionField
                    key={question.id}
                    question={question}
                    value={value}
                    onUpdate={(next) => updateExtra(question.key, next)}
                  />
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
