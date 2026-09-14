'use client';

import { useEffect, useRef, useState } from 'react';
import {
  extractIndianPassport,
  IndianPassportError,
} from '@/lib/passport/extractIndianPassport';
import {
  canvasToBlob,
  isPdfFile,
  rasterizePdfPages,
} from '@/lib/passport/pdfToImage';
import type {
  IndianPassportExtraction,
  IndianPassportFields,
  PassportFlowStage,
} from '@/lib/passport/types';
import { PassportScanStage } from './PassportScanStage';
import { PassportReviewStage, type PassportApplicationPayload } from './PassportReviewStage';
import type {
  ApplyFormConfig,
  TravellerDocumentUpload,
  TravellerTripDetails,
} from '@/lib/apply/applicationForm';

interface PassportCaptureFlowProps {
  travellerName?: string;
  initialFile?: File;
  formConfig: ApplyFormConfig;
  arrivalPrefill?: string;
  resume?: {
    fields: IndianPassportFields;
    frontPreviewUrl: string;
    backPreviewUrl?: string;
    tripDetails?: TravellerTripDetails;
    documents?: TravellerDocumentUpload[];
  };
  onClose: () => void;
  onComplete: (payload: PassportApplicationPayload) => void;
}

function toExtraction(
  resume: NonNullable<PassportCaptureFlowProps['resume']>
): IndianPassportExtraction {
  return {
    ...resume.fields,
    frontPreviewUrl: resume.frontPreviewUrl,
    backPreviewUrl: resume.backPreviewUrl,
    rawMrz: ['', ''],
    confidence: 1,
    warnings: [],
  };
}

function emptyManualExtraction(
  frontPreviewUrl: string
): IndianPassportExtraction {
  return {
    passportNumber: '',
    surname: '',
    givenNames: '',
    nationality: 'IND',
    dateOfBirth: '',
    sex: '',
    dateOfExpiry: '',
    documentType: 'P',
    countryOfIssue: 'IND',
    frontPreviewUrl,
    rawMrz: ['', ''],
    confidence: 0,
    warnings: [
      'We could not auto-fill from this scan. Please enter your details manually.',
    ],
  };
}

function isIndianGateError(err: unknown): boolean {
  return (
    err instanceof IndianPassportError &&
    /Only Indian passports are supported/i.test(err.message)
  );
}

function isManualAutofillResult(result: IndianPassportExtraction): boolean {
  return result.warnings.some((warning) =>
    /could not auto-fill/i.test(warning)
  );
}

/** Prefer the exact file the user uploaded over OCR crops when autofill fails. */
function withOriginalPreview(
  result: IndianPassportExtraction,
  originalPreviewUrl: string | null
): IndianPassportExtraction {
  if (!originalPreviewUrl) return result;
  return {
    ...result,
    frontPreviewUrl: originalPreviewUrl,
    backPreviewUrl: undefined,
  };
}

function createImageUploadPreview(input: File | Blob): string | null {
  const name = input instanceof File ? input.name : '';
  const isImage =
    input.type.startsWith('image/') ||
    /\.(jpe?g|png|webp|gif|bmp)$/i.test(name);
  if (!isImage) return null;
  return URL.createObjectURL(input);
}

/** Full first page for PDFs — used when OCR fails so the form shows the upload. */
async function createPdfUploadPreview(input: File | Blob): Promise<string | null> {
  if (!isPdfFile(input)) return null;
  try {
    const pages = await rasterizePdfPages(input, { pages: [1], maxEdge: 1600 });
    const page = pages[0];
    if (!page) return null;
    return URL.createObjectURL(await canvasToBlob(page.canvas));
  } catch {
    return null;
  }
}

const MIN_SCAN_MS = 1200;
const PASSPORT_ACCEPT =
  'image/jpeg,image/png,image/webp,image/jpg,application/pdf';

export function PassportCaptureFlow({
  initialFile,
  formConfig,
  arrivalPrefill,
  resume,
  onClose,
  onComplete,
}: PassportCaptureFlowProps) {
  const canResume = Boolean(resume?.frontPreviewUrl);
  const [stage, setStage] = useState<PassportFlowStage>(
    canResume ? 'review' : 'scan'
  );
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    resume?.frontPreviewUrl ?? null
  );
  const [extraction, setExtraction] = useState<IndianPassportExtraction | null>(
    canResume && resume ? toExtraction(resume) : null
  );
  const [scanStatus, setScanStatus] = useState('Reading MRZ…');
  const startedRef = useRef(false);
  const reuploadRef = useRef<HTMLInputElement>(null);
  const originalPreviewRef = useRef<string | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      if (originalPreviewRef.current) {
        URL.revokeObjectURL(originalPreviewRef.current);
        originalPreviewRef.current = null;
      }
    };
  }, []);

  const adoptOriginalPreview = (url: string | null) => {
    if (originalPreviewRef.current && originalPreviewRef.current !== url) {
      URL.revokeObjectURL(originalPreviewRef.current);
    }
    originalPreviewRef.current = url;
    if (url) setPreviewUrl(url);
  };

  const runExtraction = async (input: File | Blob) => {
    setError(null);
    setStage('scan');
    setScanStatus('Detecting passport page…');

    adoptOriginalPreview(createImageUploadPreview(input));
    const pdfPreviewPromise = createPdfUploadPreview(input);

    const started = Date.now();

    try {
      setScanStatus('Extracting MRZ / OCR…');
      const [result, pdfPreview] = await Promise.all([
        extractIndianPassport(input),
        pdfPreviewPromise,
      ]);
      if (!originalPreviewRef.current && pdfPreview) {
        adoptOriginalPreview(pdfPreview);
      } else if (pdfPreview && pdfPreview !== originalPreviewRef.current) {
        URL.revokeObjectURL(pdfPreview);
      }

      const elapsed = Date.now() - started;
      if (elapsed < MIN_SCAN_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, MIN_SCAN_MS - elapsed)
        );
      }

      const originalPreview = originalPreviewRef.current;
      if (isManualAutofillResult(result)) {
        const next = withOriginalPreview(result, originalPreview);
        setExtraction(next);
        setPreviewUrl(next.frontPreviewUrl);
      } else {
        if (originalPreviewRef.current) {
          URL.revokeObjectURL(originalPreviewRef.current);
          originalPreviewRef.current = null;
        }
        setExtraction(result);
        setPreviewUrl(result.frontPreviewUrl);
      }
      setStage('review');
    } catch (err) {
      const pdfPreview = await pdfPreviewPromise.catch(() => null);
      if (!originalPreviewRef.current && pdfPreview) {
        adoptOriginalPreview(pdfPreview);
      } else if (pdfPreview && pdfPreview !== originalPreviewRef.current) {
        URL.revokeObjectURL(pdfPreview);
      }

      const elapsed = Date.now() - started;
      if (elapsed < MIN_SCAN_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, MIN_SCAN_MS - elapsed)
        );
      }
      // Soft India-gate / OCR misses: open blank application form for manual entry
      if (isIndianGateError(err)) {
        const preview = originalPreviewRef.current ?? '';
        setExtraction(emptyManualExtraction(preview));
        setPreviewUrl(preview || null);
        setError(null);
        setStage('review');
        return;
      }
      const message =
        err instanceof IndianPassportError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not read this passport. Try a clearer image.';
      setError(message);
      setStage('scan');
    }
  };

  useEffect(() => {
    if (canResume || !initialFile || startedRef.current) return;
    startedRef.current = true;
    void runExtraction(initialFile);
  }, [canResume, initialFile]);

  const retryInput = (
    <input
      ref={reuploadRef}
      type="file"
      accept={PASSPORT_ACCEPT}
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void runExtraction(file);
        event.target.value = '';
      }}
    />
  );

  if (error && stage === 'scan' && !extraction) {
    return (
      <div className="fixed inset-0 z-[90] flex min-h-dvh flex-col items-center justify-center bg-white px-6">
        {retryInput}
        <p className="max-w-md text-center text-sm leading-6 text-portrait-ink">
          {error}
        </p>
        <button
          type="button"
          onClick={() => reuploadRef.current?.click()}
          className="mt-6 rounded-full bg-[#3b82f6] px-5 py-2.5 text-sm font-medium text-white"
        >
          Choose another file
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 text-sm text-slate-helper hover:text-portrait-ink"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (stage === 'scan') {
    return (
      <div className="fixed inset-0 z-[90]">
        <PassportScanStage
          previewUrl={previewUrl}
          statusText={scanStatus}
          onBack={onClose}
          onClose={onClose}
        />
      </div>
    );
  }

  if (stage === 'review' && extraction) {
    return (
      <div className="fixed inset-0 z-[90] overflow-y-auto bg-white">
        {retryInput}
        <PassportReviewStage
          initial={extraction}
          formConfig={formConfig}
          savedTrip={resume?.tripDetails}
          savedDocuments={resume?.documents}
          arrivalPrefill={arrivalPrefill}
          onBack={onClose}
          onClose={onClose}
          onEditFront={() => reuploadRef.current?.click()}
          onContinue={onComplete}
        />
      </div>
    );
  }

  return null;
}
