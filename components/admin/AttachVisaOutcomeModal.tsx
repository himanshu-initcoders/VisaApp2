'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui';
import { attachVisaOutcomeDocument } from '@/app/(admin)/actions';
import { uploadVisaOutcomeFile } from '@/lib/upload/visa-outcome-actions';
import {
  isImageFile,
  isPdfFile,
  isSendableVisaOutcomeFile,
} from '@/lib/visa/outcomeDocumentShared';
import { cn } from '@/lib/utils';

interface AttachVisaOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  travellerId: string;
  travellerName?: string | null;
  onSuccess?: () => void;
}

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

export function AttachVisaOutcomeModal({
  isOpen,
  onClose,
  applicationId,
  travellerId,
  travellerName,
  onSuccess,
}: AttachVisaOutcomeModalProps) {
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);
  const [deliveryPreviewUrl, setDeliveryPreviewUrl] = useState<string | null>(
    null
  );
  const [sendDelivery, setSendDelivery] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
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
      setDeliveryFile(null);
      setSendDelivery(false);
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

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

    if (!deliveryFile) {
      setError('Choose a file to attach');
      return;
    }
    if (sendDelivery && !isSendableVisaOutcomeFile(deliveryFile)) {
      setError('Only PDF, JPG, PNG, or WebP can be sent on WhatsApp and email');
      return;
    }

    setIsSubmitting(true);
    try {
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

      const result = await attachVisaOutcomeDocument({
        applicationId,
        travellerId,
        deliveryDocumentKey: uploaded.key,
        deliveryFilename: uploaded.filename,
        deliveryMimeType: uploaded.mimeType,
        deliveryFileSize: uploaded.size,
        sendDeliveryToChannels: sendDelivery || undefined,
      });

      if (result.success) {
        onSuccess?.();
        onClose();
      } else {
        setError(result.message || 'Failed to attach document');
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
          aria-labelledby="attach-outcome-title"
          className="pointer-events-auto relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[24px] bg-white p-6 shadow-elevated"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2
                id="attach-outcome-title"
                className="font-basier text-[31px] text-portrait-ink"
              >
                Attach visa document
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
              <label
                htmlFor="attach-outcome-file"
                className="mb-2 block font-switzer text-sm font-medium text-portrait-ink"
              >
                Visa document
              </label>
              <input
                id="attach-outcome-file"
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
                className="block w-full font-switzer text-sm text-portrait-ink file:mr-3 file:rounded-full file:border-0 file:bg-sky-wash file:px-3 file:py-1.5 file:font-switzer file:text-sm file:text-portrait-ink"
              />
              <p className="mt-1 font-switzer text-xs text-slate-helper">
                Replaces any previous document for this traveller. Checking send
                re-sends the approved WhatsApp/email with this file attached.
              </p>
            </div>

            {deliveryFile && deliveryPreviewUrl ? (
              <div className="overflow-hidden rounded-[16px] border border-ash bg-[#f8fafc]">
                <div className="border-b border-ash bg-white px-3 py-2">
                  <p className="truncate font-switzer text-xs font-semibold text-portrait-ink">
                    {deliveryFile.name}
                  </p>
                </div>
                <div className="flex min-h-[180px] items-center justify-center p-3">
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

            <label
              className={cn(
                'flex items-start gap-2 font-switzer text-sm text-portrait-ink'
              )}
            >
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

            {error ? (
              <p className="font-switzer text-sm text-red-600">{error}</p>
            ) : null}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Attach document'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
