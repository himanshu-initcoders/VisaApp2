'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Monitor,
  ScanLine,
  Upload,
} from 'lucide-react';
import type { PassportCaptureMode } from '@/lib/passport/types';

interface PassportCaptureStageProps {
  mode: PassportCaptureMode;
  onModeChange: (mode: PassportCaptureMode) => void;
  onFileSelected: (file: File | Blob) => void;
  onBack: () => void;
  error?: string | null;
}

export function PassportCaptureStage({
  mode,
  onModeChange,
  onFileSelected,
  onBack,
  error,
}: PassportCaptureStageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  useEffect(() => {
    if (mode !== 'live') {
      stopCamera();
      return;
    }

    let cancelled = false;

    async function start() {
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch {
        setCameraError(
          'Camera access denied or unavailable. Switch to Upload from device.'
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [mode, stopCamera]);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const ok =
      file.type.startsWith('image/') ||
      file.type === 'application/pdf' ||
      /\.(jpe?g|png|webp|pdf)$/i.test(file.name);
    if (!ok) {
      setCameraError('Please upload a JPG, PNG, WEBP, or PDF file.');
      return;
    }
    onFileSelected(file);
  };

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || !cameraReady) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) onFileSelected(blob);
      },
      'image/jpeg',
      0.92
    );
  };

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="relative flex items-center justify-between px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-ash bg-white px-3 py-1.5 text-sm text-portrait-ink shadow-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 text-center sm:top-5">
          <p className="font-basier text-2xl text-portrait-ink sm:text-3xl">
            Passport,
          </p>
          <p className="font-basier text-xl text-[#6b8cff] sm:text-2xl">
            photo page up
          </p>
        </div>
        <div className="hidden h-16 w-20 overflow-hidden rounded-xl border border-ash bg-sky-wash shadow-sm sm:block">
          <div className="flex h-full items-center justify-center text-[10px] font-medium uppercase tracking-wide text-slate-helper">
            Example
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-28 pt-8 sm:px-6">
        {(error || cameraError) && (
          <p className="mb-4 rounded-2xl border border-[#ff4940]/30 bg-peach-wash px-4 py-3 text-sm text-portrait-ink">
            {error || cameraError}
          </p>
        )}

        {mode === 'upload' ? (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                inputRef.current?.click();
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleFiles(event.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-fog bg-[#f5f6f8] px-6 py-16 transition-colors hover:border-[#3b82f6] hover:bg-sky-wash/40"
          >
            <Upload className="h-8 w-8 text-slate-helper" />
            <p className="mt-4 text-base font-medium text-portrait-ink">
              Upload your passport here
            </p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                inputRef.current?.click();
              }}
              className="mt-5 rounded-full border border-portrait-ink bg-white px-5 py-2.5 text-sm font-medium text-portrait-ink"
            >
              Browse files
            </button>
            <p className="mt-3 text-xs text-slate-helper">
              JPG, PNG, WEBP, or PDF · Indian passport only
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/jpg,application/pdf"
              className="hidden"
              onChange={(event) => handleFiles(event.target.files)}
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center">
            <div className="relative w-full overflow-hidden rounded-[28px] bg-[#111] aspect-[4/3]">
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {!cameraReady && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
                  Starting camera…
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={!cameraReady}
              onClick={captureFrame}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-portrait-ink px-6 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              <Camera className="h-4 w-4" />
              Capture passport page
            </button>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="flex w-full max-w-md items-center gap-1 rounded-full bg-[#eceff3] p-1.5 shadow-elevated">
          <button
            type="button"
            onClick={() => onModeChange('live')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-3 text-sm font-medium transition-colors ${
              mode === 'live'
                ? 'bg-portrait-ink text-white'
                : 'text-slate-helper'
            }`}
          >
            <ScanLine className="h-4 w-4" />
            Live Capture
          </button>
          <button
            type="button"
            onClick={() => onModeChange('upload')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-3 text-sm font-medium transition-colors ${
              mode === 'upload'
                ? 'bg-portrait-ink text-white'
                : 'text-slate-helper'
            }`}
          >
            <Monitor className="h-4 w-4" />
            Upload from device
          </button>
        </div>
      </div>
    </div>
  );
}
