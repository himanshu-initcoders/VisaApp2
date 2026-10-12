'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { applyStaffFieldEdit } from '@/app/(admin)/actions';
import {
  parseCheckboxValues,
  stringifyCheckboxValues,
} from '@/lib/apply/applicationForm';
import type { StaffEditableTarget } from '@/lib/visa/staffFields';

interface StaffFieldEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  travellerId: string;
  editor: StaffEditableTarget;
  currentRaw: string;
  currentDisplay: string;
}

function mimeFor(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return file.type || 'application/octet-stream';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export function StaffFieldEditDialog({
  isOpen,
  onClose,
  applicationId,
  travellerId,
  editor,
  currentRaw,
  currentDisplay,
}: StaffFieldEditDialogProps) {
  const router = useRouter();
  const [value, setValue] = useState(currentRaw);
  const [checks, setChecks] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    setValue(currentRaw);
    setChecks(
      editor.control.input === 'checkbox' ? parseCheckboxValues(currentRaw) : []
    );
    setFile(null);
    setMessage('');
    setError('');
  }, [isOpen, currentRaw, editor.control.input, editor.targetKey]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const note = message.trim();
    if (!note) {
      setError('Write a correction message');
      return;
    }
    if (note.length > 2000) {
      setError('Correction message must be 2000 characters or less');
      return;
    }
    if (editor.control.input === 'file' && !file) {
      setError('Choose a replacement file');
      return;
    }

    setSubmitting(true);
    try {
      const result =
        editor.control.input === 'file' && file
          ? await applyStaffFieldEdit({
              applicationId,
              travellerId,
              targetKey: editor.targetKey,
              message: note,
              file: {
                filename: file.name,
                mimeType: mimeFor(file),
                bufferBase64: await fileToBase64(file),
              },
            })
          : await applyStaffFieldEdit({
              applicationId,
              travellerId,
              targetKey: editor.targetKey,
              message: note,
              value:
                editor.control.input === 'checkbox'
                  ? stringifyCheckboxValues(checks)
                  : value,
            });
      if (!result.success) {
        setError(result.message || 'Could not save the correction');
        return;
      }
      onClose();
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not save the correction'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const control = editor.control;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-portrait-ink/40 p-4 sm:p-8">
      <form
        onSubmit={handleSubmit}
        className="my-auto w-full max-w-lg rounded-[24px] bg-white p-6 shadow-xl"
      >
        <h2 className="font-basier text-2xl text-portrait-ink">
          Edit {editor.label}
        </h2>
        <p className="mt-1 font-switzer text-sm text-slate-helper">
          Current value: {currentDisplay || '—'}
        </p>

        <div className="mt-5">
          {control.input === 'file' ? (
            <label className="block font-switzer text-sm text-portrait-ink">
              Replacement file
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="mt-1 block w-full font-switzer text-sm"
              />
            </label>
          ) : null}

          {control.input === 'text' || control.input === 'textarea' ? (
            <label className="block font-switzer text-sm text-portrait-ink">
              New value
              {control.input === 'textarea' ? (
                <textarea
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-2xl border border-ash px-3 py-2 text-sm"
                />
              ) : (
                <input
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-ash px-3 py-2 text-sm"
                />
              )}
            </label>
          ) : null}

          {control.input === 'date' ? (
            <label className="block font-switzer text-sm text-portrait-ink">
              New value
              <input
                type="date"
                value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''}
                onChange={(event) => setValue(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-ash px-3 py-2 text-sm"
              />
            </label>
          ) : null}

          {control.input === 'select' ? (
            <label className="block font-switzer text-sm text-portrait-ink">
              New value
              <select
                value={
                  control.options.some((option) => option.value === value)
                    ? value
                    : ''
                }
                onChange={(event) => setValue(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-ash bg-white px-3 py-2 text-sm"
              >
                <option value="">Choose</option>
                {control.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {control.input === 'radio' ? (
            <fieldset className="space-y-2">
              <legend className="font-switzer text-sm text-portrait-ink">
                New value
              </legend>
              {control.options.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 font-switzer text-sm text-portrait-ink"
                >
                  <input
                    type="radio"
                    name={editor.targetKey}
                    checked={value === option.value}
                    onChange={() => setValue(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          ) : null}

          {control.input === 'boolean' ? (
            <fieldset className="space-y-2">
              <legend className="font-switzer text-sm text-portrait-ink">
                New value
              </legend>
              {[
                { value: 'true', label: 'Yes' },
                { value: 'false', label: 'No' },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 font-switzer text-sm text-portrait-ink"
                >
                  <input
                    type="radio"
                    name={editor.targetKey}
                    checked={value === option.value}
                    onChange={() => setValue(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          ) : null}

          {control.input === 'checkbox' ? (
            <fieldset className="space-y-2">
              <legend className="font-switzer text-sm text-portrait-ink">
                New value
              </legend>
              {control.options.map((option) => {
                const checked = checks.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 font-switzer text-sm text-portrait-ink"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setChecks((current) =>
                          event.target.checked
                            ? [...current, option.value]
                            : current.filter((item) => item !== option.value)
                        );
                      }}
                    />
                    {option.label}
                  </label>
                );
              })}
            </fieldset>
          ) : null}
        </div>

        <label className="mt-5 block font-switzer text-sm text-portrait-ink">
          Correction message
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            placeholder="Why is this being changed?"
            className="mt-1 w-full rounded-2xl border border-ash px-3 py-2 text-sm"
          />
        </label>

        {error ? (
          <p className="mt-3 font-switzer text-sm text-[#ff4940]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save correction'}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
