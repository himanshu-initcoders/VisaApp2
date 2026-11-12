import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import type { PassportApplyFormConfig } from '@/lib/apply/passportForm';
import { getVisibleExtraQuestions } from '@/lib/question-visibility';

function answersAsStrings(
  answers: Record<string, unknown>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (value === undefined || value === null) {
      out[key] = '';
    } else if (typeof value === 'boolean') {
      out[key] = value ? 'true' : 'false';
    } else if (Array.isArray(value)) {
      out[key] = JSON.stringify(value);
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

function formatAnswer(
  value: unknown,
  options?: Array<{ label: string; value: string }>
): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const raw = String(item);
        const match = options?.find((option) => option.value === raw);
        return match?.label || raw;
      })
      .join(', ');
  }

  const raw = String(value);
  const match = options?.find((option) => option.value === raw);
  return match?.label || raw;
}

export function buildPassportDocumentLabelMap(
  snapshot: PassportApplyFormConfig | null | undefined
): Record<string, string> {
  if (!snapshot?.documentSlots?.length) return {};
  return Object.fromEntries(
    snapshot.documentSlots.map((slot) => [slot.key, slot.label])
  );
}

/**
 * Renders passport apply answers grouped by form-builder steps.
 * Skips legacy hardcoded personal/address/appointment sections.
 */
export function PassportFormAnswers({
  snapshot,
  answers,
}: {
  snapshot: PassportApplyFormConfig | null | undefined;
  answers: Record<string, unknown> | null | undefined;
}) {
  const steps = snapshot?.steps ?? [];
  const answerMap =
    answers && typeof answers === 'object' ? answers : {};
  const stringAnswers = answersAsStrings(answerMap);

  if (steps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Application answers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-switzer text-sm text-slate-helper">
            No form-builder steps were published for this application.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {steps.map((step) => {
        const visibleQuestions = getVisibleExtraQuestions(
          step.questions,
          stringAnswers
        );
        if (visibleQuestions.length === 0) return null;

        return (
          <Card key={step.id}>
            <CardHeader>
              <CardTitle>{step.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {step.description ? (
                <p className="mb-4 font-switzer text-sm text-slate-helper">
                  {step.description}
                </p>
              ) : null}
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {visibleQuestions.map((question) => (
                  <div key={question.key}>
                    <dt className="mb-1 font-switzer text-xs text-slate-helper">
                      {question.label}
                    </dt>
                    <dd className="break-words font-switzer text-sm text-portrait-ink">
                      {formatAnswer(answerMap[question.key], question.options)}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
