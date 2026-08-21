'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { addApplicationNote } from '@/app/(admin)/actions';
import { cn } from '@/lib/utils';

/**
 * Notes Modal
 *
 * Modal for adding internal notes to an application:
 * - Textarea for note content
 * - Character count (max 1000)
 * - Calls addApplicationNote Server Action
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

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setNote('');
      setError('');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate
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
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-portrait-ink/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-[24px] shadow-elevated max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-basier text-[31px] text-portrait-ink">
            Add Note
          </h2>
          <button
            onClick={onClose}
            className="text-slate-helper hover:text-portrait-ink transition-colors"
          >
            <svg
              className="w-6 h-6"
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
          {/* Note textarea */}
          <div>
            <label
              htmlFor="note"
              className="block font-switzer text-sm font-medium text-portrait-ink mb-2"
            >
              Internal Note
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add an internal note about this application..."
              rows={6}
              maxLength={1000}
              disabled={isSubmitting}
              className={cn(
                'w-full font-switzer text-sm text-portrait-ink',
                'bg-white border border-ash rounded-[16px]',
                'px-4 py-3',
                'focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:ring-opacity-20',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'resize-none'
              )}
            />
            <p className="mt-1 font-switzer text-xs text-slate-helper">
              {note.length}/1000 characters
            </p>
          </div>

          {/* Error message */}
          {error && (
            <p className="font-switzer text-sm text-red-600">{error}</p>
          )}

          {/* Actions */}
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
              disabled={isSubmitting || note.trim() === ''}
            >
              {isSubmitting ? 'Adding...' : 'Add Note'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
