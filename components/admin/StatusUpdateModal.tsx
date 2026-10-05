'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button, Badge, Select, getStatusVariant } from '@/components/ui';
import { updateApplicationStatus } from '@/app/(admin)/actions';
import { cn } from '@/lib/utils';

/**
 * Status Update Modal
 *
 * Portaled to document.body so the backdrop covers the full viewport
 * (avoids top gap from admin layout padding / containing blocks).
 */

interface StatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  applicationType: 'visa' | 'passport';
  travellerId?: string;
  travellerName?: string | null;
  currentStatus: string;
  onSuccess?: () => void;
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted'],
  submitted: ['under_review'],
  under_review: ['approved', 'rejected', 'submitted'],
  approved: [],
  rejected: ['submitted'],
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export function StatusUpdateModal({
  isOpen,
  onClose,
  applicationId,
  applicationType,
  travellerId,
  travellerName,
  currentStatus,
  onSuccess,
}: StatusUpdateModalProps) {
  const [newStatus, setNewStatus] = useState(currentStatus);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  const validStatuses = STATUS_TRANSITIONS[currentStatus] || [];
  const allowedOptions = STATUS_OPTIONS.filter((opt) =>
    validStatuses.includes(opt.value)
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setNewStatus(allowedOptions[0]?.value || currentStatus);
      setNotes('');
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when opening / status changes
  }, [isOpen, currentStatus]);

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

    if (newStatus === currentStatus) {
      setError('Please select a different status');
      return;
    }

    if (newStatus === 'rejected' && notes.trim() === '') {
      setError('Notes are required when rejecting an application');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await updateApplicationStatus({
        applicationId,
        applicationType,
        travellerId,
        newStatus,
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(result.message || 'Failed to update status');
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
      {/* Full-viewport backdrop — no padding so it covers edge-to-edge */}
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-portrait-ink/50"
        onClick={onClose}
      />

      {/* Centering layer; padding only here so backdrop stays flush */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-update-title"
          className="pointer-events-auto relative w-full max-w-md rounded-[24px] bg-white p-6 shadow-elevated"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2
                id="status-update-title"
                className="font-basier text-[31px] text-portrait-ink"
              >
                Update Status
              </h2>
              {travellerName ? (
                <p className="font-switzer text-sm text-slate-helper">
                  {travellerName}
                </p>
              ) : null}
            </div>
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
              <label className="mb-2 block font-switzer text-sm font-medium text-portrait-ink">
                Current Status
              </label>
              <Badge variant={getStatusVariant(currentStatus)}>
                {currentStatus}
              </Badge>
            </div>

            {allowedOptions.length > 0 ? (
              <Select
                label="New Status"
                options={allowedOptions}
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                disabled={isSubmitting}
              />
            ) : (
              <p className="font-switzer text-sm text-slate-helper">
                No status transitions available from {currentStatus}
              </p>
            )}

            <div>
              <label
                htmlFor="notes"
                className="mb-2 block font-switzer text-sm font-medium text-portrait-ink"
              >
                Notes{' '}
                {newStatus === 'rejected' && (
                  <span className="text-red-600">*</span>
                )}
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  newStatus === 'rejected'
                    ? 'Please provide a reason for rejection...'
                    : 'Optional notes about this status change...'
                }
                rows={4}
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
                {notes.length}/1000 characters
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
                disabled={isSubmitting || allowedOptions.length === 0}
              >
                {isSubmitting ? 'Updating...' : 'Update Status'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
