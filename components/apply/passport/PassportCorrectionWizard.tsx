'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select } from '@/components/ui';
import { Checkbox } from '@/components/ui/Checkbox';
import { submitPassportCorrection } from '@/app/(dashboard)/actions';
import { trackEvent } from '@/lib/analytics/gtm';
import type { PassportApplyFormConfig } from '@/lib/apply/passportForm';
import type { CorrectionItemView } from '@/components/apply/CorrectionWizard';

interface PassportCorrectionWizardProps {
  applicationId: string;
  productName: string;
  formConfig: PassportApplyFormConfig;
  answers: Record<string, unknown>;
  items: CorrectionItemView[];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64 || '');
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function PassportCorrectionWizard({
  applicationId,
  productName,
  formConfig,
  answers,
  items,
}: PassportCorrectionWizardProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const item of items) {
      if (item.kind !== 'field') continue;
      const current = answers[item.targetKey];
      initial[item.targetKey] =
        current == null
          ? ''
          : Array.isArray(current)
            ? current.join(',')
            : String(current);
    }
    return initial;
  });
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startedTrackedRef = useRef(false);

  useEffect(() => {
    if (startedTrackedRef.current) return;
    startedTrackedRef.current = true;
    trackEvent('passport_correction_started', {
      application_id: applicationId,
      item_count: items.length,
    });
  }, [applicationId, items.length]);

  const questionByKey = useMemo(() => {
    const map = new Map<
      string,
      PassportApplyFormConfig['steps'][number]['questions'][number]
    >();
    for (const step of formConfig.steps) {
      for (const question of step.questions) {
        map.set(question.key, question);
      }
    }
    return map;
  }, [formConfig.steps]);

  const handleSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      const fieldPayload: Record<string, string> = {};
      for (const item of items) {
        if (item.kind !== 'field') continue;
        const next = (values[item.targetKey] || '').trim();
        if (!next) {
          setError(`Please update “${item.label}”.`);
          setBusy(false);
          return;
        }
        fieldPayload[item.targetKey] = next;
      }

      const filePayload = [];
      for (const item of items) {
        if (item.kind !== 'document') continue;
        const file = files[item.targetKey];
        if (!file) {
          setError(`Please reupload “${item.label}”.`);
          setBusy(false);
          return;
        }
        filePayload.push({
          slotKey: item.targetKey,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          bufferBase64: await fileToBase64(file),
        });
      }

      const result = await submitPassportCorrection({
        applicationId,
        fields: fieldPayload,
        files: filePayload,
      });
      if (!result.success) {
        setError(result.message || 'Could not submit updates');
        return;
      }
      trackEvent('passport_correction_submitted', {
        application_id: applicationId,
        fields_changed_count: Object.keys(fieldPayload).length,
        files_count: filePayload.length,
      });
      router.push(`/applications/passport/${applicationId}`);
      router.refresh();
    } catch {
      setError('Something went wrong while submitting.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="font-switzer text-xs font-semibold uppercase tracking-wider text-slate-helper">
          Action required
        </p>
        <h1 className="mt-1 font-basier text-3xl text-portrait-ink">
          Fix {productName}
        </h1>
        <p className="mt-2 text-sm text-slate-helper">
          Update only the items below, then resubmit for review.
        </p>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          if (item.kind === 'document') {
            return (
              <div
                key={item.targetKey}
                className="rounded-3xl border border-ash-divider bg-white p-5"
              >
                <p className="text-sm font-medium text-portrait-ink">
                  {item.label}
                </p>
                <p className="mt-1 text-xs text-slate-helper">{item.comment}</p>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="mt-3 block w-full text-sm"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setFiles((prev) => ({ ...prev, [item.targetKey]: file }));
                  }}
                />
              </div>
            );
          }

          const question = questionByKey.get(item.targetKey);
          const type = question?.questionType || 'text';
          return (
            <div
              key={item.targetKey}
              className="rounded-3xl border border-ash-divider bg-white p-5"
            >
              <p className="text-sm font-medium text-portrait-ink">
                {item.label}
              </p>
              <p className="mt-1 text-xs text-slate-helper">{item.comment}</p>
              <div className="mt-3">
                {type === 'boolean' ? (
                  <Checkbox
                    label="Yes"
                    checked={values[item.targetKey] === 'true'}
                    onChange={(checked) =>
                      setValues((prev) => ({
                        ...prev,
                        [item.targetKey]: checked ? 'true' : 'false',
                      }))
                    }
                  />
                ) : type === 'dropdown' || type === 'radio' ? (
                  <Select
                    options={[
                      { value: '', label: 'Select…' },
                      ...(question?.options || []).map((option) => ({
                        value: option.value,
                        label: option.label,
                      })),
                    ]}
                    value={values[item.targetKey] || ''}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        [item.targetKey]: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <Input
                    type={type === 'date' ? 'date' : 'text'}
                    value={values[item.targetKey] || ''}
                    onChange={(event) =>
                      setValues((prev) => ({
                        ...prev,
                        [item.targetKey]: event.target.value,
                      }))
                    }
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <Button
        type="button"
        variant="primary"
        disabled={busy}
        onClick={() => void handleSubmit()}
      >
        {busy ? 'Submitting…' : 'Submit updates'}
      </Button>
    </div>
  );
}
