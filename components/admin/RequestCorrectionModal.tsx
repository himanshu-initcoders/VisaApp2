'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui';
import { requestCorrection } from '@/app/(admin)/actions';
import type { CorrectableTarget } from '@/lib/visa/corrections';

interface TravellerOption {
  id: string;
  name: string;
}

interface RequestCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  travellers: TravellerOption[];
  targets: CorrectableTarget[];
  initialTravellerId?: string;
  initialSlotKey?: string;
  onSuccess?: () => void;
}

export function RequestCorrectionModal({
  isOpen,
  onClose,
  applicationId,
  travellers,
  targets,
  initialTravellerId,
  initialSlotKey,
  onSuccess,
}: RequestCorrectionModalProps) {
  const [travellerId, setTravellerId] = useState(initialTravellerId || '');
  const [selected, setSelected] = useState<string[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    setTravellerId(initialTravellerId || travellers[0]?.id || '');
    setSelected(initialSlotKey ? [initialSlotKey] : []);
    setComments(initialSlotKey ? { [initialSlotKey]: '' } : {});
    setMessage('');
    setError('');
  }, [isOpen, initialTravellerId, initialSlotKey, travellers]);

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

  const groups = useMemo(() => {
    const map = new Map<string, CorrectableTarget[]>();
    for (const target of targets) {
      const list = map.get(target.group) ?? [];
      list.push(target);
      map.set(target.group, list);
    }
    return [...map.entries()];
  }, [targets]);

  if (!isOpen || !mounted) return null;

  const toggle = (targetKey: string) => {
    setSelected((current) =>
      current.includes(targetKey)
        ? current.filter((key) => key !== targetKey)
        : [...current, targetKey]
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!travellerId) {
      setError('Choose a traveller');
      return;
    }
    if (selected.length === 0) {
      setError('Select at least one field or document');
      return;
    }
    if (!message.trim()) {
      setError('Write an overall message for the applicant');
      return;
    }
    const missing = selected.find((key) => !comments[key]?.trim());
    if (missing) {
      setError('Add a comment for every selected item');
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestCorrection({
        applicationId,
        travellerId,
        message: message.trim(),
        items: selected.map((targetKey) => {
          const target = targets.find((item) => item.targetKey === targetKey);
          return {
            kind: target?.kind ?? 'field',
            targetKey,
            comment: comments[targetKey].trim(),
          };
        }),
      });
      if (!result.success) {
        setError(result.message || 'Could not send the request');
        return;
      }
      onSuccess?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-portrait-ink/40 p-4 sm:p-8">
      <form
        onSubmit={handleSubmit}
        className="my-auto w-full max-w-2xl rounded-[24px] bg-white p-6 shadow-xl"
      >
        <h2 className="font-basier text-2xl text-portrait-ink">Request changes</h2>
        <p className="mt-1 font-switzer text-sm text-slate-helper">
          The applicant will see the full application, with only these items unlocked.
        </p>

        <label className="mt-5 block font-switzer text-sm text-portrait-ink">
          Traveller
          <select
            value={travellerId}
            onChange={(event) => setTravellerId(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-ash bg-white px-3 py-2 text-sm"
          >
            {travellers.map((traveller) => (
              <option key={traveller.id} value={traveller.id}>
                {traveller.name}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-5 max-h-[40vh] space-y-4 overflow-y-auto pr-1">
          {groups.map(([group, items]) => (
            <fieldset key={group} className="space-y-2">
              <legend className="font-switzer text-xs font-semibold uppercase tracking-wider text-slate-helper">
                {group}
              </legend>
              {items.map((item) => {
                const checked = selected.includes(item.targetKey);
                return (
                  <div key={item.targetKey} className="rounded-2xl border border-ash px-3 py-2">
                    <label className="flex items-center gap-2 font-switzer text-sm text-portrait-ink">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(item.targetKey)}
                      />
                      {item.label}
                    </label>
                    {checked && (
                      <textarea
                        value={comments[item.targetKey] ?? ''}
                        onChange={(event) =>
                          setComments((current) => ({
                            ...current,
                            [item.targetKey]: event.target.value,
                          }))
                        }
                        rows={2}
                        placeholder="What should they change?"
                        className="mt-2 w-full rounded-xl border border-ash px-3 py-2 font-switzer text-sm"
                      />
                    )}
                  </div>
                );
              })}
            </fieldset>
          ))}
        </div>

        <label className="mt-5 block font-switzer text-sm text-portrait-ink">
          Message to the applicant
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-2xl border border-ash px-3 py-2 text-sm"
          />
        </label>

        {error && (
          <p className="mt-3 font-switzer text-sm text-[#ff4940]" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send request'}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}
