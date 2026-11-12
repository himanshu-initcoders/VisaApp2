'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  getMissingPassportDocuments,
  type PassportApplyFormConfig,
} from '@/lib/apply/passportForm';
import {
  normalizePassportDraftUploads,
  PASSPORT_DRAFT_COUNTRY_CODE,
  PASSPORT_DRAFT_PASSENGER_ID,
  type PassportDraftUpload,
} from '@/lib/apply/passportDraftFiles';
import { deleteServerDraftFile } from '@/lib/apply/deleteDraftFileClient';
import { trackEvent } from '@/lib/analytics/gtm';
import { passportPriceLabel } from '@/lib/passport/constants';
import {
  createPassportCheckoutOrder,
  quotePassportCheckout,
  verifyPassportCheckout,
} from '@/lib/payments/actions';
import {
  loadPassportDraft,
  savePassportDraft,
} from '@/lib/apply/passportDraftActions';
import { PassportApplyDocumentsPanel } from '@/components/apply/passport-service/PassportApplyDocumentsPanel';
import { cn } from '@/lib/utils';

type PackagePrice = {
  id: string;
  scheme: 'normal' | 'tatkaal';
  bookletPages: '36' | '60';
  governmentFeeAmount: string;
  serviceFeeAmount: string;
  governmentGstFeeAmount: string;
};

type MacroStage = 'form' | 'documents' | 'review';

interface ApplyPassportWizardProps {
  listingId: string;
  serviceType: 'fresh' | 'reissue';
  productName: string;
  /** e.g. "Fresh Indian passport · Normal · 36 pages" from URL selection */
  selectionLabel: string;
  formConfig: PassportApplyFormConfig;
  /** Locked from /passport pricing card via ?priceOption= */
  priceOptionId: string;
  prices: PackagePrice[];
  isSignedIn: boolean;
}

function feeRupees(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

function formatInrRupees(amount: number) {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

type PassportRazorpayCheckout = {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
};

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  const win = window as Window & {
    Razorpay?: new (options: Record<string, unknown>) => PassportRazorpayCheckout;
  };
  if (win.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function formatInrPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

export function ApplyPassportWizard({
  listingId,
  serviceType,
  productName,
  selectionLabel,
  formConfig,
  priceOptionId,
  prices,
  isSignedIn,
}: ApplyPassportWizardProps) {
  const router = useRouter();
  const [submitId] = useState(() => crypto.randomUUID());
  const hasDocuments = formConfig.documentSlots.length > 0;
  const selectedPrice =
    prices.find((price) => price.id === priceOptionId) || prices[0];
  const [macro, setMacro] = useState<MacroStage>(() => {
    if (formConfig.steps.length > 0) return 'form';
    if (formConfig.documentSlots.length > 0) return 'documents';
    return 'review';
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [uploadedDocuments, setUploadedDocuments] = useState<
    Record<string, PassportDraftUpload>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadBusyKey, setUploadBusyKey] = useState<string | null>(null);
  const [quote, setQuote] = useState<{
    amountPaise: number;
    governmentFeePaise: number;
    serviceFeePaise: number;
    gstFeePaise: number;
    free: boolean;
  } | null>(null);
  const enterTrackedRef = useRef(false);
  const reviewTrackedRef = useRef(false);
  const beginCheckoutTrackedRef = useRef(false);

  const steps = formConfig.steps;
  const currentStep = steps[stepIndex];

  useEffect(() => {
    if (enterTrackedRef.current) return;
    enterTrackedRef.current = true;
    trackEvent('passport_apply_enter', {
      service_type: serviceType,
      listing_id: listingId,
      price_option: priceOptionId,
      product_name: productName,
    });
  }, [listingId, priceOptionId, productName, serviceType]);

  useEffect(() => {
    trackEvent('passport_wizard_step_view', {
      stage: macro,
      step_index: macro === 'form' ? stepIndex : undefined,
      step_title:
        macro === 'form'
          ? currentStep?.title
          : macro === 'documents'
            ? 'Documents'
            : 'Review & pay',
      listing_id: listingId,
      service_type: serviceType,
    });
  }, [macro, stepIndex, currentStep?.title, listingId, serviceType]);

  useEffect(() => {
    if (macro !== 'review' || reviewTrackedRef.current) return;
    reviewTrackedRef.current = true;
    const value =
      typeof quote?.amountPaise === 'number' ? quote.amountPaise / 100 : undefined;
    trackEvent('passport_review_proceed_checkout', {
      listing_id: listingId,
      service_type: serviceType,
      value,
      currency: 'INR',
    });
  }, [macro, quote?.amountPaise, listingId, serviceType]);

  useEffect(() => {
    if (
      macro !== 'review' ||
      beginCheckoutTrackedRef.current ||
      typeof quote?.amountPaise !== 'number'
    ) {
      return;
    }
    beginCheckoutTrackedRef.current = true;
    const value = quote.amountPaise / 100;
    trackEvent('begin_checkout', {
      listing_id: listingId,
      country_code: 'IN',
      currency: 'INR',
      value,
      traveller_count: 1,
      items: [
        {
          item_id: listingId,
          item_name: productName,
          item_category: serviceType,
          price: value,
          quantity: 1,
        },
      ],
    });
  }, [macro, quote?.amountPaise, listingId, productName, serviceType]);

  const totalFormSteps = steps.length;
  const totalStages =
    Math.max(totalFormSteps, 0) + (hasDocuments ? 1 : 0) + 1;

  const progressLabel = useMemo(() => {
    if (macro === 'form' && currentStep) {
      return `Step ${stepIndex + 1} of ${totalStages} — ${currentStep.title}`;
    }
    if (macro === 'documents' && hasDocuments) {
      return `Step ${totalFormSteps + 1} of ${totalStages} — Documents`;
    }
    return `Step ${totalStages} of ${totalStages} — Review & pay`;
  }, [
    macro,
    currentStep,
    stepIndex,
    totalFormSteps,
    totalStages,
    hasDocuments,
  ]);

  const progressPct = useMemo(() => {
    let index = 0;
    if (macro === 'form') index = stepIndex;
    else if (macro === 'documents' && hasDocuments) index = totalFormSteps;
    else index = totalFormSteps + (hasDocuments ? 1 : 0);
    return Math.round(((index + 1) / Math.max(totalStages, 1)) * 100);
  }, [macro, stepIndex, totalFormSteps, totalStages, hasDocuments]);

  useEffect(() => {
    if (!isSignedIn) return;
    void loadPassportDraft(listingId).then((result) => {
      if (!result.success || !result.draft) return;
      const draft = result.draft;
      if (draft.answers && typeof draft.answers === 'object') {
        setAnswers(draft.answers as Record<string, unknown>);
      }
      // priceOptionId stays locked from the URL selection — do not override from draft.
      if (draft.uploadedDocuments && typeof draft.uploadedDocuments === 'object') {
        setUploadedDocuments(
          normalizePassportDraftUploads(draft.uploadedDocuments)
        );
      }
      if (
        draft.macro === 'form' ||
        draft.macro === 'documents' ||
        draft.macro === 'review'
      ) {
        // Skip empty documents stage for older drafts that stopped there.
        if (draft.macro === 'documents' && formConfig.documentSlots.length === 0) {
          setMacro('review');
        } else {
          setMacro(draft.macro);
        }
      } else if (draft.macro === 'pay') {
        // Legacy drafts that stopped on removed package step.
        setMacro('review');
      }
      if (typeof draft.stepIndex === 'number' && draft.stepIndex >= 0) {
        setStepIndex(draft.stepIndex);
      }
    });
  }, [isSignedIn, listingId, formConfig.documentSlots.length]);

  useEffect(() => {
    if (macro === 'documents' && !hasDocuments) {
      setMacro('review');
    }
  }, [macro, hasDocuments]);

  useEffect(() => {
    if (!priceOptionId) return;
    void quotePassportCheckout({ listingId, priceOptionId }).then((result) => {
      if (result.success) {
        setQuote({
          amountPaise: result.amountPaise,
          governmentFeePaise: result.governmentFeePaise,
          serviceFeePaise: result.serviceFeePaise,
          gstFeePaise: result.gstFeePaise,
          free: result.free,
        });
      }
    });
  }, [listingId, priceOptionId]);

  const persistDraft = async (overrides?: {
    answers?: Record<string, unknown>;
    priceOptionId?: string;
    uploadedDocuments?: Record<string, PassportDraftUpload>;
    macro?: MacroStage;
    stepIndex?: number;
  }) => {
    if (!isSignedIn) return;
    await savePassportDraft({
      listingId,
      payload: {
        answers: overrides?.answers ?? answers,
        priceOptionId: overrides?.priceOptionId ?? priceOptionId,
        uploadedDocuments: overrides?.uploadedDocuments ?? uploadedDocuments,
        macro: overrides?.macro ?? macro,
        stepIndex: overrides?.stepIndex ?? stepIndex,
      },
    });
  };

  const validateCurrentStep = (): string | null => {
    if (macro !== 'form' || !currentStep) return null;
    for (const question of currentStep.questions) {
      if (!question.required) continue;
      const value = answers[question.key];
      if (
        value === undefined ||
        value === null ||
        value === '' ||
        (Array.isArray(value) && value.length === 0)
      ) {
        return `Please answer “${question.label}”.`;
      }
    }
    return null;
  };

  const validateRequiredDocuments = (): string | null => {
    const missing = getMissingPassportDocuments(
      formConfig.documentSlots,
      uploadedDocuments
    );
    if (missing.length === 0) return null;
    if (missing.length === 1) {
      return `Please upload “${missing[0].label}” before continuing.`;
    }
    return `Please upload required documents: ${missing
      .map((slot) => slot.label)
      .join(', ')}.`;
  };

  const goBack = () => {
    setError(null);
    if (macro === 'form') {
      if (stepIndex > 0) {
        setStepIndex((i) => i - 1);
        return;
      }
      router.push('/passport');
      return;
    }
    if (macro === 'documents') {
      if (totalFormSteps > 0) {
        setMacro('form');
        setStepIndex(Math.max(totalFormSteps - 1, 0));
      } else {
        router.push('/passport');
      }
      return;
    }
    if (macro === 'review') {
      if (hasDocuments) {
        setMacro('documents');
        return;
      }
      if (totalFormSteps > 0) {
        setMacro('form');
        setStepIndex(Math.max(totalFormSteps - 1, 0));
        return;
      }
      router.push('/passport');
    }
  };

  const selectPackage = (nextPriceOptionId: string) => {
    if (!nextPriceOptionId || nextPriceOptionId === priceOptionId) return;
    void persistDraft({ priceOptionId: nextPriceOptionId });
    router.replace(
      `/passport/${serviceType}/apply?priceOption=${encodeURIComponent(nextPriceOptionId)}`,
      { scroll: false }
    );
  };

  const goNext = async () => {
    setError(null);
    if (macro === 'form') {
      const validation = validateCurrentStep();
      if (validation) {
        setError(validation);
        return;
      }
      await persistDraft();
      if (stepIndex < totalFormSteps - 1) {
        setStepIndex((i) => i + 1);
        return;
      }
      setMacro(hasDocuments ? 'documents' : 'review');
      return;
    }
    if (macro === 'documents') {
      if (!hasDocuments) {
        setMacro('review');
        return;
      }
      const documentsError = validateRequiredDocuments();
      if (documentsError) {
        setError(documentsError);
        return;
      }
      await persistDraft();
      setMacro('review');
    }
  };

  const uploadDocument = async (slotKey: string, file: File) => {
    if (!isSignedIn) {
      trackEvent('passport_apply_login_prompt', {
        source: 'documents',
        listing_id: listingId,
        service_type: serviceType,
      });
      setError('Sign in to upload documents.');
      return;
    }

    setUploadBusyKey(slotKey);
    setError(null);
    try {
      const previous = uploadedDocuments[slotKey];
      const form = new FormData();
      form.set('listingId', listingId);
      form.set('countryCode', PASSPORT_DRAFT_COUNTRY_CODE);
      form.set('passengerId', PASSPORT_DRAFT_PASSENGER_ID);
      form.set('slotKey', slotKey);
      if (previous?.storageKey) {
        form.set('previousStorageKey', previous.storageKey);
      }
      form.set('file', file);

      const response = await fetch('/api/apply/draft-files', {
        method: 'POST',
        body: form,
      });
      const data = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        result?: {
          key?: string;
          filename?: string;
          mimeType?: string;
          size?: number;
        };
      } | null;

      if (!response.ok || !data?.success || !data.result?.key) {
        const message = data?.error || 'Upload failed. Try again.';
        trackEvent('passport_document_upload_error', {
          slot_key: slotKey,
          listing_id: listingId,
          error_message: message,
        });
        setError(message);
        return;
      }

      const nextUpload: PassportDraftUpload = {
        storageKey: data.result.key,
        filename: data.result.filename || file.name,
        mimeType: data.result.mimeType || file.type || undefined,
        size: data.result.size ?? file.size,
      };
      const nextUploads = {
        ...uploadedDocuments,
        [slotKey]: nextUpload,
      };
      setUploadedDocuments(nextUploads);
      await persistDraft({ uploadedDocuments: nextUploads });
      trackEvent('passport_document_upload_success', {
        slot_key: slotKey,
        listing_id: listingId,
        mime_type: nextUpload.mimeType,
      });
    } catch (err) {
      console.error('passport draft upload failed:', err);
      trackEvent('passport_document_upload_error', {
        slot_key: slotKey,
        listing_id: listingId,
        error_message: 'Upload failed. Try again.',
      });
      setError('Upload failed. Try again.');
    } finally {
      setUploadBusyKey(null);
    }
  };

  const removeDocument = async (slotKey: string) => {
    const previous = uploadedDocuments[slotKey];
    const nextUploads = { ...uploadedDocuments };
    delete nextUploads[slotKey];
    setUploadedDocuments(nextUploads);
    await persistDraft({ uploadedDocuments: nextUploads });
    if (previous?.storageKey) {
      void deleteServerDraftFile({ storageKey: previous.storageKey });
    }
  };

  const trackPassportPurchase = (input: {
    applicationId: string;
    value: number;
    free?: boolean;
  }) => {
    trackEvent('purchase', {
      transaction_id: input.applicationId,
      currency: 'INR',
      value: input.value,
      listing_id: listingId,
      country_code: 'IN',
      traveller_count: 1,
      free: input.free,
      items: [
        {
          item_id: listingId,
          item_name: productName,
          item_category: serviceType,
          price: input.value,
          quantity: 1,
        },
      ],
    });
    trackEvent('passport_application_submitted', {
      application_id: input.applicationId,
      listing_id: listingId,
      service_type: serviceType,
      value: input.value,
      currency: 'INR',
      free: input.free,
    });
  };

  const handlePay = async () => {
    if (!isSignedIn) {
      trackEvent('passport_apply_login_prompt', {
        source: 'pay',
        listing_id: listingId,
        service_type: serviceType,
      });
      setError('Sign in to pay and submit.');
      return;
    }
    if (!priceOptionId) {
      setError('Choose a passport package.');
      return;
    }
    if (hasDocuments) {
      const documentsError = validateRequiredDocuments();
      if (documentsError) {
        setError(documentsError);
        setMacro('documents');
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const order = await createPassportCheckoutOrder({
        submitId,
        listingId,
        priceOptionId,
      });
      if (!order.success) {
        trackEvent('passport_payment_failed', {
          listing_id: listingId,
          service_type: serviceType,
          error_description: order.error,
          submit_id: submitId,
        });
        setError(order.error);
        return;
      }

      if (order.kind === 'free') {
        trackEvent('passport_payment_order_created', {
          listing_id: listingId,
          service_type: serviceType,
          kind: 'free',
          amount: 0,
          currency: 'INR',
        });
        const submitted = await verifyPassportCheckout({
          submitId,
          listingId,
          priceOptionId,
          answers,
          uploadedDocuments,
        });
        if (!submitted.success) {
          trackEvent('passport_payment_failed', {
            listing_id: listingId,
            service_type: serviceType,
            error_description: submitted.error,
            submit_id: submitId,
          });
          setError(submitted.error);
          return;
        }
        trackPassportPurchase({
          applicationId: submitted.applicationId,
          value: 0,
          free: true,
        });
        router.push(
          `/applications/passport/${submitted.referenceNumber || submitted.applicationId}`
        );
        return;
      }

      if (order.kind !== 'order') {
        setError('Unexpected checkout state.');
        return;
      }

      trackEvent('passport_payment_order_created', {
        listing_id: listingId,
        service_type: serviceType,
        kind: 'order',
        amount: order.amount / 100,
        currency: order.currency || 'INR',
      });

      const scriptReady = await loadRazorpayScript();
      const RazorpayCtor = (
        window as Window & {
          Razorpay?: new (
            options: Record<string, unknown>
          ) => PassportRazorpayCheckout;
        }
      ).Razorpay;
      if (!scriptReady || !RazorpayCtor) {
        trackEvent('passport_payment_failed', {
          listing_id: listingId,
          service_type: serviceType,
          error_description: 'Could not load Razorpay.',
          submit_id: submitId,
        });
        setError('Could not load Razorpay.');
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const razorpay = new RazorpayCtor({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: 'Viserv',
          description: productName,
          order_id: order.orderId,
          handler: async (response: RazorpaySuccess) => {
            try {
              const submitted = await verifyPassportCheckout({
                submitId,
                listingId,
                priceOptionId,
                answers,
                uploadedDocuments,
                paymentId: order.paymentId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              if (!submitted.success) {
                trackEvent('passport_payment_failed', {
                  listing_id: listingId,
                  service_type: serviceType,
                  error_description: submitted.error,
                  submit_id: submitId,
                });
                setError(submitted.error);
                reject(new Error(submitted.error));
                return;
              }
              trackPassportPurchase({
                applicationId: submitted.applicationId,
                value: order.amount / 100,
                free: false,
              });
              router.push(
                `/applications/passport/${submitted.referenceNumber || submitted.applicationId}`
              );
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        });
        razorpay.on('payment.failed', () => {
          trackEvent('passport_payment_failed', {
            listing_id: listingId,
            service_type: serviceType,
            error_description: 'Payment failed. Try again.',
            submit_id: submitId,
          });
          setError('Payment failed. Try again.');
          reject(new Error('payment failed'));
        });
        razorpay.open();
      });
    } finally {
      setBusy(false);
    }
  };

  const setAnswer = (key: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="relative min-h-dvh bg-[#f4f7fb] pb-28">
      <header className="relative z-20 px-4 pb-2 pt-4 sm:px-8 sm:pt-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1.5 text-sm text-slate-helper transition-colors hover:text-portrait-ink"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <p className="min-w-0 text-right text-sm font-medium leading-snug text-portrait-ink sm:text-base">
            <span className="inline-flex max-w-full items-center justify-end gap-2">
              <span
                className="relative flex h-5 w-5 shrink-0 overflow-hidden rounded-full border border-ash bg-white sm:h-6 sm:w-6"
                aria-hidden
              >
                <span className="flex size-full items-center justify-center text-[10px] leading-none sm:text-xs">
                  🇮🇳
                </span>
              </span>
              <span className="min-w-0 truncate">{selectionLabel}</span>
            </span>
            <span className="sr-only">{productName}</span>
          </p>
        </div>
        <div className="mx-auto mt-4 max-w-3xl">
          <p className="text-sm text-slate-helper">{progressLabel}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e5ebf3]">
            <div
              className="h-full rounded-full bg-[#2563EB] transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl flex-1 px-4 py-6 sm:px-6">
        {macro === 'form' && currentStep && (
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-medium text-portrait-ink">
                {currentStep.title}
              </h2>
              {currentStep.description && (
                <p className="mt-2 text-sm leading-6 text-slate-helper">
                  {currentStep.description}
                </p>
              )}
            </div>
            <div className="space-y-4">
              {currentStep.questions.map((question) => (
                <QuestionField
                  key={question.key}
                  question={question}
                  value={answers[question.key]}
                  onChange={(value) => setAnswer(question.key, value)}
                />
              ))}
              {currentStep.questions.length === 0 && (
                <p className="rounded-3xl border border-dashed border-ash-divider p-6 text-sm text-slate-helper">
                  No questions in this step yet. Continue to the next section.
                </p>
              )}
            </div>
          </section>
        )}

        {macro === 'documents' && (
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-medium text-portrait-ink">Documents</h2>
              <p className="mt-2 text-sm text-slate-helper">
                Upload clear scans or photos. PDF, JPG, or PNG work best.
              </p>
            </div>
            <PassportApplyDocumentsPanel
              slots={formConfig.documentSlots}
              uploads={uploadedDocuments}
              uploadBusyKey={uploadBusyKey}
              isSignedIn={isSignedIn}
              disabled={busy}
              onUpload={(slotKey, file) => {
                void uploadDocument(slotKey, file);
              }}
              onRemove={(slotKey) => {
                void removeDocument(slotKey);
              }}
            />
          </section>
        )}

        {macro === 'review' && (
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-medium text-portrait-ink">Review</h2>
              <p className="mt-2 text-sm text-slate-helper">
                Check your answers before payment. You can go back to edit any step.
              </p>
            </div>
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="rounded-3xl border border-ash-divider bg-white p-5"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-medium text-portrait-ink">{step.title}</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setMacro('form');
                      setStepIndex(index);
                    }}
                  >
                    Edit
                  </Button>
                </div>
                <dl className="space-y-2 text-sm">
                  {step.questions.map((q) => (
                    <div key={q.key} className="flex justify-between gap-4">
                      <dt className="text-slate-helper">{q.label}</dt>
                      <dd className="text-right text-portrait-ink">
                        {formatAnswer(answers[q.key])}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
            {hasDocuments ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-portrait-ink">Documents</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setMacro('documents')}
                  >
                    Edit
                  </Button>
                </div>
                <PassportApplyDocumentsPanel
                  slots={formConfig.documentSlots}
                  uploads={uploadedDocuments}
                  readOnly
                />
              </div>
            ) : null}

            <div className="rounded-3xl border border-ash-divider bg-white p-5">
              <h3 className="font-medium text-portrait-ink">Package</h3>
              <p className="mt-1 text-sm text-slate-helper">
                {productName} — choose Normal/Tatkaal and booklet size.
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {prices.map((price) => {
                  const isSelected = price.id === (selectedPrice?.id || priceOptionId);
                  const total =
                    feeRupees(price.governmentFeeAmount) +
                    feeRupees(price.serviceFeeAmount) +
                    feeRupees(price.governmentGstFeeAmount);
                  return (
                    <button
                      key={price.id}
                      type="button"
                      onClick={() => selectPackage(price.id)}
                      disabled={busy || Boolean(uploadBusyKey)}
                      className={cn(
                        'rounded-2xl border px-4 py-3 text-left transition-colors',
                        isSelected
                          ? 'border-portrait-ink bg-sky-wash/50 ring-1 ring-portrait-ink'
                          : 'border-ash-divider bg-white hover:border-portrait-ink/40'
                      )}
                      aria-pressed={isSelected}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-portrait-ink">
                            {passportPriceLabel(price.scheme, price.bookletPages)}
                          </p>
                          <p className="mt-1 text-xs text-slate-helper">
                            {isSelected ? 'Selected' : 'Tap to select'}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-medium tabular-nums text-portrait-ink">
                            {formatInrRupees(total)}
                          </p>
                          {isSelected ? (
                            <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-portrait-ink text-white">
                              <Check className="h-3 w-3" aria-hidden />
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {quote ? (
                <div className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-slate-helper">Government fee</span>
                    <span>{formatInrPaise(quote.governmentFeePaise)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-helper">Service fee</span>
                    <span>{formatInrPaise(quote.serviceFeePaise)}</span>
                  </div>
                  {quote.gstFeePaise > 0 && (
                    <div className="flex justify-between py-1">
                      <span className="text-slate-helper">GST</span>
                      <span>{formatInrPaise(quote.gstFeePaise)}</span>
                    </div>
                  )}
                  <div className="mt-2 flex justify-between border-t border-ash-divider pt-3 font-medium">
                    <span>Total</span>
                    <span>{formatInrPaise(quote.amountPaise)}</span>
                  </div>
                </div>
              ) : null}
              {!isSignedIn ? (
                <p className="mt-4 text-sm text-slate-helper">
                  <Link href="/login" className="text-[#2563EB] underline">
                    Sign in
                  </Link>{' '}
                  to complete payment.
                </p>
              ) : null}
            </div>
          </section>
        )}

        {error && (
          <p className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-ash-divider bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl gap-3">
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={goBack}
            disabled={busy || Boolean(uploadBusyKey)}
          >
            <span className="inline-flex items-center gap-2">
              <ChevronLeft className="h-4 w-4 shrink-0" />
              Back
            </span>
          </Button>
          {macro === 'review' ? (
            <Button
              type="button"
              variant="primary"
              className="flex-[1.4]"
              onClick={() => void handlePay()}
              disabled={busy || Boolean(uploadBusyKey)}
            >
              {busy
                ? 'Working…'
                : quote?.free
                  ? 'Submit application'
                  : 'Pay & submit'}
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              className="flex-[1.4]"
              onClick={() => void goNext()}
              disabled={busy || Boolean(uploadBusyKey)}
            >
              <span className="inline-flex items-center gap-2">
                Continue
                <ChevronRight className="h-4 w-4 shrink-0" />
              </span>
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function formatAnswer(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function QuestionLabel({
  label,
  description,
  required,
}: {
  label: string;
  description?: string | null;
  required?: boolean;
}) {
  return (
    <div className="mb-2">
      <p className="block font-switzer text-sm font-medium text-portrait-ink">
        {label}
        {required ? <span className="text-[#ff4940]"> *</span> : null}
      </p>
      {description ? (
        <p className="mt-1 font-switzer text-xs text-slate-helper">{description}</p>
      ) : null}
    </div>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: PassportApplyFormConfig['steps'][number]['questions'][number];
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const description = question.description?.trim() || '';
  const required = Boolean(question.required);
  const isTextLike =
    question.questionType === 'text' || question.questionType === 'textarea';

  if (question.questionType === 'boolean') {
    return (
      <Checkbox
        label={
          required ? (
            <>
              {question.label}
              <span className="text-[#ff4940]"> *</span>
            </>
          ) : (
            question.label
          )
        }
        description={description || undefined}
        checked={Boolean(value)}
        onChange={onChange}
      />
    );
  }

  if (
    question.questionType === 'dropdown' ||
    question.questionType === 'radio'
  ) {
    return (
      <div className="w-full">
        <QuestionLabel
          label={question.label}
          description={description}
          required={required}
        />
        <Select
          options={[
            { value: '', label: 'Select…' },
            ...question.options.map((o) => ({ value: o.value, label: o.label })),
          ]}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (question.questionType === 'checkbox') {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="space-y-2">
        <QuestionLabel
          label={question.label}
          description={description}
          required={required}
        />
        {question.options.map((option) => (
          <Checkbox
            key={option.value}
            label={option.label}
            checked={selected.includes(option.value)}
            onChange={(checked) => {
              onChange(
                checked
                  ? [...selected, option.value]
                  : selected.filter((v) => v !== option.value)
              );
            }}
          />
        ))}
      </div>
    );
  }

  if (isTextLike) {
    if (question.questionType === 'textarea') {
      return (
        <div className="w-full">
          <QuestionLabel
            label={question.label}
            required={required}
          />
          <textarea
            className="w-full rounded-input border border-ash bg-white px-4 py-2.5 font-switzer text-base text-portrait-ink placeholder:text-slate-helper transition-colors duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-portrait-ink"
            rows={4}
            placeholder={description || undefined}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            required={required}
          />
        </div>
      );
    }

    return (
      <div className="w-full">
        <QuestionLabel label={question.label} required={required} />
        <Input
          placeholder={description || undefined}
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
      </div>
    );
  }

  // date and any other non-text controls: description under the question label
  return (
    <div className="w-full">
      <QuestionLabel
        label={question.label}
        description={description}
        required={required}
      />
      <Input
        type={question.questionType === 'date' ? 'date' : 'text'}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}
