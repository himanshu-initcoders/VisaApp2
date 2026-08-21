'use client';

import { useState, useEffect } from 'react';
import { Button, Badge, Select, getStatusVariant } from '@/components/ui';
import { updateApplicationStatus } from '@/app/(admin)/actions';
import { cn } from '@/lib/utils';

/**
 * Status Update Modal
 *
 * Modal for changing application status with validation:
 * - Shows current status
 * - Dropdown for new status (filtered by valid transitions)
 * - Required notes for rejection
 * - Calls updateApplicationStatus Server Action
 */

interface StatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  applicationType: 'visa' | 'passport';
  currentStatus: string;
  onSuccess?: () => void;
}

// Valid status transitions
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
  currentStatus,
  onSuccess,
}: StatusUpdateModalProps) {
  const [newStatus, setNewStatus] = useState(currentStatus);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Get valid next statuses
  const validStatuses = STATUS_TRANSITIONS[currentStatus] || [];
  const allowedOptions = STATUS_OPTIONS.filter(
    (opt) => validStatuses.includes(opt.value)
  );

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setNewStatus(allowedOptions[0]?.value || currentStatus);
      setNotes('');
      setError('');
    }
  }, [isOpen, currentStatus]);

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
        newStatus,
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(result.message || 'Failed to update status');
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
            Update Status
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
          {/* Current Status */}
          <div>
            <label className="block font-switzer text-sm font-medium text-portrait-ink mb-2">
              Current Status
            </label>
            <Badge variant={getStatusVariant(currentStatus)}>
              {currentStatus}
            </Badge>
          </div>

          {/* New Status */}
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

          {/* Notes */}
          <div>
            <label
              htmlFor="notes"
              className="block font-switzer text-sm font-medium text-portrait-ink mb-2"
            >
              Notes {newStatus === 'rejected' && <span className="text-red-600">*</span>}
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
                'bg-white border border-ash rounded-[16px]',
                'px-4 py-3',
                'focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:ring-opacity-20',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'resize-none'
              )}
            />
            <p className="mt-1 font-switzer text-xs text-slate-helper">
              {notes.length}/1000 characters
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
              disabled={isSubmitting || allowedOptions.length === 0}
            >
              {isSubmitting ? 'Updating...' : 'Update Status'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
