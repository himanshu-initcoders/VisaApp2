'use client';

import { useEffect, useState } from 'react';
import {
  extractIndianPassport,
  IndianPassportError,
} from '@/lib/passport/extractIndianPassport';
import type {
  IndianPassportExtraction,
  IndianPassportFields,
  PassportCaptureMode,
  PassportFlowStage,
} from '@/lib/passport/types';
import { PassportCaptureStage } from './PassportCaptureStage';
import { PassportScanStage } from './PassportScanStage';
import { PassportReviewStage } from './PassportReviewStage';

interface PassportCaptureFlowProps {
  travellerName?: string;
  onClose: () => void;
  onComplete: (payload: {
    fields: IndianPassportFields;
    frontPreviewUrl: string;
    backPreviewUrl?: string;
  }) => void;
}

const MIN_SCAN_MS = 1200;

export function PassportCaptureFlow({
  onClose,
  onComplete,
}: PassportCaptureFlowProps) {
  const [stage, setStage] = useState<PassportFlowStage>('capture');
  const [mode, setMode] = useState<PassportCaptureMode>('upload');
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<IndianPassportExtraction | null>(
    null
  );
  const [scanStatus, setScanStatus] = useState('Reading MRZ…');

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const runExtraction = async (input: File | Blob) => {
    setError(null);
    setStage('scan');
    setScanStatus('Detecting passport page…');

    // PDFs cannot render in <img>; the scan stage falls back to a placeholder
    const isImage = input.type.startsWith('image/');
    const localPreview = isImage ? URL.createObjectURL(input) : null;
    setPreviewUrl(localPreview);

    const started = Date.now();

    try {
      setScanStatus('Extracting MRZ / OCR…');
      const result = await extractIndianPassport(input);
      const elapsed = Date.now() - started;
      if (elapsed < MIN_SCAN_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, MIN_SCAN_MS - elapsed)
        );
      }
      setExtraction(result);
      setPreviewUrl(result.frontPreviewUrl);
      setStage('review');
    } catch (err) {
      const message =
        err instanceof IndianPassportError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not read this passport. Try a clearer image.';
      setError(message);
      setStage('capture');
    }
  };

  if (stage === 'scan') {
    return (
      <div className="fixed inset-0 z-[90]">
        <PassportScanStage
          previewUrl={previewUrl}
          statusText={scanStatus}
          onBack={() => {
            setStage('capture');
            setError(null);
          }}
          onClose={onClose}
        />
      </div>
    );
  }

  if (stage === 'review' && extraction) {
    return (
      <div className="fixed inset-0 z-[90] overflow-y-auto bg-white">
        <PassportReviewStage
          initial={extraction}
          onBack={() => setStage('capture')}
          onClose={onClose}
          onEditFront={() => {
            setExtraction(null);
            setStage('capture');
          }}
          onContinue={(fields) => {
            onComplete({
              fields,
              frontPreviewUrl: extraction.frontPreviewUrl,
              backPreviewUrl: extraction.backPreviewUrl,
            });
          }}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-white">
      <PassportCaptureStage
        mode={mode}
        onModeChange={setMode}
        onFileSelected={(file) => {
          void runExtraction(file);
        }}
        onBack={onClose}
        error={error}
      />
    </div>
  );
}
