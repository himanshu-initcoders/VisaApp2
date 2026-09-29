'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui';
import { addApplicationNote } from '@/app/(admin)/actions';
import { cn } from '@/lib/utils';

/**
 * Notes Modal — portaled to document.body for full-viewport backdrop.
 */

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  applicationType: 'visa' | 'passport';
  onSuccess?: () => void;
}

export function NotesModal({
  isOpen,
  onClose,
  applicationId,
  applicationType,
  onSuccess,
}: NotesModalProps) {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setNote('');
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (note.trim() === '') {
      setError('Please enter a note');
      return;
    }

    if (note.length > 1000) {
      setError('Note must be 1000 characters or less');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await addApplicationNote({
        applicationId,
        applicationType,
        note: note.trim(),
      });

      if (result.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(result.message || 'Failed to add note');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="presentation">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-portrait-ink/50"
        onClick={onClose}
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-note-title"
          className="pointer-events-auto relative w-full max-w-md rounded-[24px] bg-white p-6 shadow-elevated"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2
              id="add-note-title"
              className="font-basier text-[31px] text-portrait-ink"
            >
              Add Note
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-helper transition-colors hover:text-portrait-ink"
              aria-label="Close"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="note"
                className="mb-2 block font-switzer text-sm font-medium text-portrait-ink"
              >
                Note
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add an internal note…"
                rows={5}
                maxLength={1000}
                disabled={isSubmitting}
                className={cn(
                  'w-full font-switzer text-sm text-portrait-ink',
                  'rounded-[16px] border border-ash bg-white',
                  'px-4 py-3',
                  'focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:ring-opacity-20',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  'resize-none'
                )}
              />
              <p className="mt-1 font-switzer text-xs text-slate-helper">
                {note.length}/1000 characters
              </p>
            </div>

            {error && (
              <p className="font-switzer text-sm text-red-600">{error}</p>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !note.trim()}
              >
                {isSubmitting ? 'Saving…' : 'Add Note'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
