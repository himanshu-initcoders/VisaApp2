'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button, Badge, Select, getStatusVariant } from '@/components/ui';
import { updateApplicationStatus } from '@/app/(admin)/actions';
import { uploadVisaOutcomeFile } from '@/lib/upload/visa-outcome-actions';
import { formatInrFromPaise } from '@/lib/payments/money';
import { cn } from '@/lib/utils';
import type {
  CapturedPaymentForReject,
  RejectTravellerOption,
} from '@/types/admin';

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
  capturedPayment?: CapturedPaymentForReject | null;
  travellers?: RejectTravellerOption[];
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted'],
  submitted: ['under_review', 'action_required'],
  under_review: ['approved', 'rejected', 'submitted', 'action_required'],
  action_required: ['under_review', 'approved', 'rejected'],
  approved: [],
  // `rejected` again = retry refund after a failed gateway/row create
  rejected: ['submitted', 'rejected'],
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'action_required', label: 'Action required' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const OPEN_STATUSES = new Set([
  'submitted',
  'under_review',
  'action_required',
]);

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

function perTravellerSharePaise(amountPaise: number, travellerCount: number) {
  const count = Math.max(1, Math.trunc(travellerCount) || 1);
  return Math.floor(Math.max(0, Math.trunc(amountPaise)) / count);
}

function refundNotesText(amountPaise: number): string {
  const rupees = (Math.max(0, Math.trunc(amountPaise)) / 100).toLocaleString(
    'en-IN',
    { minimumFractionDigits: 0, maximumFractionDigits: 2 }
  );
  return `A refund of ₹${rupees} will be processed in 7–10 working days.`;
}

function paiseFromRupeeInput(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(raw)) return null;
  const [whole, frac = ''] = raw.split('.');
  const rupees = Number(whole);
  const paisePart = Number(frac.padEnd(2, '0').slice(0, 2) || '0');
  if (!Number.isSafeInteger(rupees) || !Number.isSafeInteger(paisePart)) {
    return null;
  }
  return rupees * 100 + paisePart;
}

function rupeeInputFromPaise(paise: number): string {
  const abs = Math.max(0, Math.trunc(paise));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, '0')}`;
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
  capturedPayment = null,
  travellers = [],
}: StatusUpdateModalProps) {
  const [newStatus, setNewStatus] = useState(currentStatus);
  const [notes, setNotes] = useState('');
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const [sendDelivery, setSendDelivery] = useState(false);
  const [rejectAll, setRejectAll] = useState(false);
  const [refundRupees, setRefundRupees] = useState('');
  const [refundEdited, setRefundEdited] = useState(false);
  const [autoNotes, setAutoNotes] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  const validStatuses = STATUS_TRANSITIONS[currentStatus] || [];
  const allowedOptions = STATUS_OPTIONS.filter((opt) =>
    validStatuses.includes(opt.value)
  );
  const showDelivery =
    applicationType === 'visa' && newStatus === 'approved' && Boolean(travellerId);
  const showRejectRefund =
    applicationType === 'visa' &&
    newStatus === 'rejected' &&
    Boolean(capturedPayment?.razorpayPaymentId);

  const openSiblings = useMemo(() => {
    if (!travellerId) return [];
    return travellers.filter(
      (t) => t.id !== travellerId && OPEN_STATUSES.has(t.status)
    );
  }, [travellers, travellerId]);

  const rejectNameList = useMemo(() => {
    const current =
      travellers.find((t) => t.id === travellerId)?.name?.trim() ||
      travellerName?.trim() ||
      'Traveller';
    if (!rejectAll) return [current];
    return [
      current,
      ...openSiblings.map((t) => t.name.trim() || 'Traveller'),
    ];
  }, [travellers, travellerId, travellerName, rejectAll, openSiblings]);

  const defaultRefundPaise = useMemo(() => {
    if (!capturedPayment) return 0;
    const share = perTravellerSharePaise(
      capturedPayment.amountPaise,
      capturedPayment.travellerCount
    );
    const count = rejectAll ? 1 + openSiblings.length : 1;
    return share * count;
  }, [capturedPayment, rejectAll, openSiblings.length]);

  const refundPaise = paiseFromRupeeInput(refundRupees);
  const refundCapError =
    showRejectRefund &&
    capturedPayment &&
    refundPaise != null &&
    refundPaise > capturedPayment.amountPaise
      ? `Refund cannot exceed the original amount of ${formatInrFromPaise(capturedPayment.amountPaise)}`
      : '';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setNewStatus(allowedOptions[0]?.value || currentStatus);
      setNotes('');
      setDeliveryFile(null);
      setSendDelivery(false);
      setRejectAll(false);
      setRefundRupees('');
      setRefundEdited(false);
      setAutoNotes('');
      setConfirmStep(false);
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when opening / status changes
  }, [isOpen, currentStatus]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (confirmStep) {
          setConfirmStep(false);
          return;
        }
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, confirmStep]);

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
    if (!showRejectRefund || !capturedPayment) {
      setRejectAll(false);
      setRefundRupees('');
      setRefundEdited(false);
      setAutoNotes('');
      setConfirmStep(false);
      return;
    }
    if (!refundEdited) {
      setRefundRupees(rupeeInputFromPaise(defaultRefundPaise));
    }
  }, [
    showRejectRefund,
    capturedPayment,
    defaultRefundPaise,
    refundEdited,
    rejectAll,
  ]);

  useEffect(() => {
    if (!showRejectRefund || refundPaise == null) return;
    const next = refundNotesText(refundPaise);
    setNotes((prev) => {
      if (!prev.trim() || prev === autoNotes) {
        return next;
      }
      return prev;
    });
    setAutoNotes(next);
  }, [showRejectRefund, refundPaise, autoNotes]);

  const runUpdate = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      let deliveryDocumentKey: string | undefined;
      let deliveryFilename: string | undefined;
      let deliveryMimeType: string | undefined;
      let deliveryFileSize: number | undefined;

      if (showDelivery && deliveryFile && travellerId) {
        const bufferBase64 = await fileToBase64(deliveryFile);
        const uploaded = await uploadVisaOutcomeFile({
          applicationId,
          travellerId,
          filename: deliveryFile.name,
          mimeType: deliveryFile.type || 'application/octet-stream',
          bufferBase64,
          requirePdf: sendDelivery,
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
        ...(showRejectRefund && refundPaise != null
          ? {
              refundAmountPaise: refundPaise,
              rejectAllTravellers: rejectAll || undefined,
            }
          : rejectAll
            ? { rejectAllTravellers: true }
            : {}),
      });

      if (result.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(result.message || 'Failed to update status');
        setConfirmStep(false);
      }
    } catch {
      setError('An unexpected error occurred');
      setConfirmStep(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const isRefundRetry =
      newStatus === 'rejected' && currentStatus === 'rejected';
    if (newStatus === currentStatus && !isRefundRetry) {
      setError('Please select a different status');
      return;
    }
    if (isRefundRetry && !showRejectRefund) {
      setError('No captured payment is available to refund');
      return;
    }

    if (newStatus === 'rejected' && notes.trim() === '') {
      setError('Notes are required when rejecting an application');
      return;
    }

    if (sendDelivery && !deliveryFile) {
      setError('Choose a PDF to send on WhatsApp and email');
      return;
    }

    if (sendDelivery && deliveryFile && deliveryFile.type !== 'application/pdf') {
      setError('Only PDF files can be sent on WhatsApp and email');
      return;
    }

    if (showRejectRefund) {
      if (refundPaise == null) {
        setError('Enter a valid refund amount');
        return;
      }
      if (refundCapError) {
        setError(refundCapError);
        return;
      }
      setConfirmStep(true);
      return;
    }

    await runUpdate();
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
          className="pointer-events-auto relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[24px] bg-white p-6 shadow-elevated"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2
                id="status-update-title"
                className="font-basier text-[31px] text-portrait-ink"
              >
                {confirmStep ? 'Confirm rejection' : 'Update Status'}
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

          {confirmStep && showRejectRefund && capturedPayment ? (
            <div className="space-y-4">
              <p className="rounded-[16px] border border-peach-wash bg-peach-wash/40 px-4 py-3 font-switzer text-sm text-portrait-ink">
                This will reject the traveller(s) below and start a Razorpay
                refund. This cannot be undone from this screen.
              </p>
              <dl className="space-y-3 rounded-[16px] border border-ash px-4 py-3">
                <div>
                  <dt className="font-switzer text-xs text-slate-helper">
                    Traveller(s)
                  </dt>
                  <dd className="font-switzer text-sm text-portrait-ink">
                    {rejectNameList.join(', ')}
                  </dd>
                </div>
                <div>
                  <dt className="font-switzer text-xs text-slate-helper">
                    Status
                  </dt>
                  <dd>
                    <Badge variant="rejected">rejected</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="font-switzer text-xs text-slate-helper">
                    Refund amount
                  </dt>
                  <dd className="font-switzer text-sm text-portrait-ink">
                    {formatInrFromPaise(refundPaise ?? 0)}
                    <span className="mt-1 block text-xs text-slate-helper">
                      Original total{' '}
                      {formatInrFromPaise(capturedPayment.amountPaise)}
                    </span>
                  </dd>
                </div>
              </dl>

              {error && (
                <p className="font-switzer text-sm text-red-600">{error}</p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmStep(false)}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={isSubmitting}
                  onClick={() => void runUpdate()}
                >
                  {isSubmitting ? 'Processing…' : 'Confirm and refund'}
                </Button>
              </div>
            </div>
          ) : (
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
                  onChange={(e) => {
                    setNewStatus(e.target.value);
                    setConfirmStep(false);
                    setRefundEdited(false);
                  }}
                  disabled={isSubmitting}
                />
              ) : (
                <p className="font-switzer text-sm text-slate-helper">
                  No status transitions available from {currentStatus}
                </p>
              )}

              {showRejectRefund && capturedPayment ? (
                <div className="space-y-3 rounded-[16px] border border-ash bg-sky-wash/30 p-4">
                  <div>
                    <label
                      htmlFor="refund-amount"
                      className="mb-2 block font-switzer text-sm font-medium text-portrait-ink"
                    >
                      Refund amount (₹)
                    </label>
                    <input
                      id="refund-amount"
                      type="text"
                      inputMode="decimal"
                      value={refundRupees}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        setRefundEdited(true);
                        setRefundRupees(e.target.value);
                      }}
                      className={cn(
                        'w-full font-switzer text-sm text-portrait-ink',
                        'rounded-[16px] border border-ash bg-white',
                        'px-4 py-3',
                        'focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:ring-opacity-20',
                        'disabled:cursor-not-allowed disabled:opacity-50'
                      )}
                    />
                    <p className="mt-1 font-switzer text-xs text-slate-helper">
                      Default is one traveller share (
                      {formatInrFromPaise(
                        perTravellerSharePaise(
                          capturedPayment.amountPaise,
                          capturedPayment.travellerCount
                        )
                      )}
                      ). Original total{' '}
                      {formatInrFromPaise(capturedPayment.amountPaise)}.
                    </p>
                    {refundCapError ? (
                      <p className="mt-1 font-switzer text-sm text-red-600">
                        {refundCapError}
                      </p>
                    ) : null}
                  </div>

                  {openSiblings.length > 0 ? (
                    <label className="flex items-start gap-2 font-switzer text-sm text-portrait-ink">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={rejectAll}
                        disabled={isSubmitting}
                        onChange={(e) => {
                          setRejectAll(e.target.checked);
                          setRefundEdited(false);
                        }}
                      />
                      <span>
                        Reject complete visa application for all travellers
                        <span className="mt-0.5 block text-xs text-slate-helper">
                          Also rejects {openSiblings.length} open traveller
                          {openSiblings.length === 1 ? '' : 's'}. Approved
                          travellers are left unchanged.
                        </span>
                      </span>
                    </label>
                  ) : null}
                </div>
              ) : null}

              {applicationType === 'visa' &&
              newStatus === 'rejected' &&
              !showRejectRefund &&
              openSiblings.length > 0 ? (
                <label className="flex items-start gap-2 font-switzer text-sm text-portrait-ink">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={rejectAll}
                    disabled={isSubmitting}
                    onChange={(e) => setRejectAll(e.target.checked)}
                  />
                  <span>
                    Reject complete visa application for all travellers
                    <span className="mt-0.5 block text-xs text-slate-helper">
                      Also rejects {openSiblings.length} open traveller
                      {openSiblings.length === 1 ? '' : 's'}. Approved
                      travellers are left unchanged.
                    </span>
                  </span>
                </label>
              ) : null}

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
                        if (!file || file.type !== 'application/pdf') {
                          setSendDelivery(false);
                        }
                      }}
                      className="block w-full font-switzer text-sm text-portrait-ink file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1.5 file:font-switzer file:text-sm file:text-portrait-ink"
                    />
                    <p className="mt-1 font-switzer text-xs text-slate-helper">
                      PDF, JPG, PNG, or WebP. Sending on WhatsApp requires PDF.
                    </p>
                    {deliveryFile ? (
                      <p className="mt-1 font-switzer text-xs text-portrait-ink">
                        Selected: {deliveryFile.name}
                      </p>
                    ) : null}
                  </div>

                  <label className="flex items-start gap-2 font-switzer text-sm text-portrait-ink">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={sendDelivery}
                      disabled={
                        isSubmitting ||
                        !deliveryFile ||
                        deliveryFile.type !== 'application/pdf'
                      }
                      onChange={(e) => setSendDelivery(e.target.checked)}
                    />
                    <span>
                      Send this file on WhatsApp and email
                      {!deliveryFile || deliveryFile.type !== 'application/pdf' ? (
                        <span className="mt-0.5 block text-xs text-slate-helper">
                          Select a PDF to enable sending.
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
                  disabled={
                    isSubmitting ||
                    allowedOptions.length === 0 ||
                    Boolean(refundCapError)
                  }
                >
                  {isSubmitting
                    ? 'Updating...'
                    : showRejectRefund
                      ? 'Continue'
                      : 'Update Status'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
