'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button, Badge, Select, getStatusVariant } from '@/components/ui';
import { updateApplicationStatus } from '@/app/(admin)/actions';
import { uploadVisaOutcomeFile } from '@/lib/upload/visa-outcome-actions';
import {
  isImageFile,
  isPdfFile,
  isSendableVisaOutcomeFile,
} from '@/lib/visa/outcomeDocumentShared';
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
  submitted: ['under_review', 'action_required'],
  under_review: ['approved', 'rejected', 'action_required'],
  action_required: ['under_review', 'approved', 'rejected'],
  approved: [],
  rejected: ['submitted'],
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'action_required', label: 'Action required' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read file'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

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
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const [deliveryPreviewUrl, setDeliveryPreviewUrl] = useState<string | null>(
    null
  );
  const [sendDelivery, setSendDelivery] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  const validStatuses = STATUS_TRANSITIONS[currentStatus] || [];
  const allowedOptions = STATUS_OPTIONS.filter((opt) =>
    validStatuses.includes(opt.value)
  );
  const showDelivery =
    applicationType === 'visa' && newStatus === 'approved' && Boolean(travellerId);
  const deliveryIsPdf = Boolean(deliveryFile && isPdfFile(deliveryFile));
  const deliveryIsImage = Boolean(deliveryFile && isImageFile(deliveryFile));
  const canSendDelivery = Boolean(
    deliveryFile && isSendableVisaOutcomeFile(deliveryFile)
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setNewStatus(allowedOptions[0]?.value || currentStatus);
      setNotes('');
      setDeliveryFile(null);
      setSendDelivery(false);
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

  useEffect(() => {
    if (!showDelivery) {
      setDeliveryFile(null);
      setSendDelivery(false);
    }
  }, [showDelivery]);

  useEffect(() => {
    if (!deliveryFile) {
      setDeliveryPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(deliveryFile);
    setDeliveryPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [deliveryFile]);

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

    if (sendDelivery && !deliveryFile) {
      setError('Choose a PDF or image to send on WhatsApp and email');
      return;
    }

    if (
      sendDelivery &&
      deliveryFile &&
      !isSendableVisaOutcomeFile(deliveryFile)
    ) {
      setError('Only PDF, JPG, PNG, or WebP can be sent on WhatsApp and email');
      return;
    }

    setIsSubmitting(true);

    try {
      let deliveryDocumentKey: string | undefined;
      let deliveryFilename: string | undefined;
      let deliveryMimeType: string | undefined;
      let deliveryFileSize: number | undefined;

      if (showDelivery && deliveryFile && travellerId) {
        const bufferBase64 = await fileToBase64(deliveryFile);
        const mimeType = isPdfFile(deliveryFile)
          ? 'application/pdf'
          : isImageFile(deliveryFile)
            ? deliveryFile.type ||
              (/\.png$/i.test(deliveryFile.name)
                ? 'image/png'
                : /\.webp$/i.test(deliveryFile.name)
                  ? 'image/webp'
                  : 'image/jpeg')
            : deliveryFile.type || 'application/octet-stream';
        const uploaded = await uploadVisaOutcomeFile({
          applicationId,
          travellerId,
          filename: deliveryFile.name,
          mimeType,
          bufferBase64,
          requireSendable: sendDelivery,
        });
        if (!uploaded.success) {
          setError(uploaded.error);
          return;
        }
        deliveryDocumentKey = uploaded.key;
        deliveryFilename = uploaded.filename;
        deliveryMimeType = uploaded.mimeType;
        deliveryFileSize = uploaded.size;
      }

      const result = await updateApplicationStatus({
        applicationId,
        applicationType,
        travellerId,
        newStatus,
        notes: notes.trim() || undefined,
        deliveryDocumentKey,
        deliveryFilename,
        deliveryMimeType,
        deliveryFileSize,
        sendDeliveryToChannels: sendDelivery || undefined,
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
          aria-labelledby="status-update-title"
          className="pointer-events-auto relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[24px] bg-white p-6 shadow-elevated"
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

            {showDelivery ? (
              <div className="space-y-3 rounded-[16px] border border-ash bg-sky-wash/30 p-4">
                <div>
                  <label
                    htmlFor="delivery-file"
                    className="mb-2 block font-switzer text-sm font-medium text-portrait-ink"
                  >
                    Visa document (optional)
                  </label>
                  <input
                    id="delivery-file"
                    type="file"
                    accept=".pdf,application/pdf,image/jpeg,image/png,image/webp"
                    disabled={isSubmitting}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setDeliveryFile(file);
                      if (!file || !isSendableVisaOutcomeFile(file)) {
                        setSendDelivery(false);
                      }
                    }}
                    className="block w-full font-switzer text-sm text-portrait-ink file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1.5 file:font-switzer file:text-sm file:text-portrait-ink"
                  />
                  <p className="mt-1 font-switzer text-xs text-slate-helper">
                    PDF, JPG, PNG, or WebP. Any of these can be sent on WhatsApp
                    and email.
                  </p>
                </div>

                {deliveryFile && deliveryPreviewUrl ? (
                  <div className="overflow-hidden rounded-[16px] border border-ash bg-white">
                    <div className="border-b border-ash px-3 py-2">
                      <p className="truncate font-switzer text-xs font-semibold text-portrait-ink">
                        {deliveryFile.name}
                      </p>
                      <p className="font-switzer text-[11px] text-slate-helper">
                        {(deliveryFile.size / 1024).toFixed(1)} KB
                        {deliveryIsPdf
                          ? ' · PDF'
                          : deliveryIsImage
                            ? ' · Image'
                            : ''}
                      </p>
                    </div>
                    <div className="flex min-h-[180px] items-center justify-center bg-[#f8fafc] p-3">
                      {deliveryIsImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={deliveryPreviewUrl}
                          alt={deliveryFile.name}
                          className="max-h-[240px] max-w-full object-contain"
                        />
                      ) : deliveryIsPdf ? (
                        <iframe
                          title={deliveryFile.name}
                          src={deliveryPreviewUrl}
                          className="h-[240px] w-full rounded-xl bg-white"
                        />
                      ) : (
                        <p className="font-switzer text-sm text-slate-helper">
                          Preview not available for this file type.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}

                <label className="flex items-start gap-2 font-switzer text-sm text-portrait-ink">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={sendDelivery}
                    disabled={isSubmitting || !canSendDelivery}
                    onChange={(e) => setSendDelivery(e.target.checked)}
                  />
                  <span>
                    Send this file on WhatsApp and email
                    {!canSendDelivery ? (
                      <span className="mt-0.5 block text-xs text-slate-helper">
                        Select a PDF or image (JPG, PNG, WebP) to enable sending.
                      </span>
                    ) : null}
                  </span>
                </label>
              </div>
            ) : null}

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
