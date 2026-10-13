'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X } from 'lucide-react';
import {
  PassportPhotoCaptureError,
  createPassportPhotoEngine,
  type PassportPhotoEngine,
  type PhotoCaptureRead,
} from '@/lib/apply/passportPhotoCapture';

interface PassportPhotoCaptureDialogProps {
  onClose: () => void;
  onCaptured: (file: File) => void;
}

export function PassportPhotoCaptureDialog({
  onClose,
  onCaptured,
}: PassportPhotoCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<PassportPhotoEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [read, setRead] = useState<PhotoCaptureRead | null>(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    let inspecting = false;
    let lastInspect = 0;

    async function startCamera() {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (cancelled) {
        media.getTracks().forEach((track) => track.stop());
        return null;
      }
      stream = media;
      const video = videoRef.current;
      if (!video) {
        media.getTracks().forEach((track) => track.stop());
        return null;
      }
      video.srcObject = media;
      await video.play();
      return media;
    }

    async function start() {
      const held: { engine: PassportPhotoEngine | null } = { engine: null };
      let rejectEngine = false;
      try {
        const [created] = await Promise.all([
          createPassportPhotoEngine().then((value) => {
            if (cancelled || rejectEngine) {
              value.close();
              return value;
            }
            held.engine = value;
            return value;
          }),
          startCamera(),
        ]);
        if (cancelled) {
          created.close();
          return;
        }
        engineRef.current = created;
        setReady(true);

        const loop = (now: number) => {
          frame = requestAnimationFrame(loop);
          const video = videoRef.current;
          if (!video || inspecting || now - lastInspect < 220) return;
          lastInspect = now;
          inspecting = true;
          void created
            .inspect(video)
            .then((next) => {
              if (!cancelled) setRead(next);
            })
            .catch(() => {
              if (!cancelled) {
                setFatal(
                  'Face check stopped working. Close this and try again, or upload a photo from your device.'
                );
              }
            })
            .finally(() => {
              inspecting = false;
            });
        };
        frame = requestAnimationFrame(loop);
      } catch {
        rejectEngine = true;
        held.engine?.close();
        if (!cancelled) {
          setFatal(
            'Camera or face check could not start. Allow camera access, or upload a photo from your device.'
          );
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      engineRef.current?.close();
      engineRef.current = null;
    };
  }, []);

  const capture = async () => {
    const video = videoRef.current;
    const engine = engineRef.current;
    if (!video || !engine || read?.status !== 'ready' || capturing) return;
    setCapturing(true);
    try {
      const file = await engine.capture(video);
      onCaptured(file);
    } catch (error) {
      if (error instanceof PassportPhotoCaptureError) {
        setRead({ status: error.status, message: error.message });
      } else {
        setFatal('Could not save this photo. Try again.');
      }
    } finally {
      setCapturing(false);
    }
  };

  const glasses = read?.status === 'glasses';
  const canCapture = ready && !fatal && read?.status === 'ready' && !capturing;
  const ovalClass = glasses
    ? 'border-[#ff4940]'
    : read?.status === 'ready'
      ? 'border-[#00a32a]'
      : 'border-white/85';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close face capture"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="passport-photo-capture-title"
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-[24px] bg-white shadow-elevated"
      >
        <div className="flex items-start justify-between gap-3 border-b border-ash px-5 py-4">
          <div>
            <h2
              id="passport-photo-capture-title"
              className="font-basier text-2xl text-portrait-ink"
            >
              Capture passport photo
            </h2>
            <p className="mt-1 text-sm text-slate-helper">
              Look straight ahead with your face in the oval. Glasses are not
              allowed.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-helper transition-colors hover:bg-sky-wash hover:text-portrait-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-5">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-[28px] bg-[#111]">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="h-full w-full scale-x-[-1] object-cover"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className={`h-[70%] w-[66%] rounded-[50%] border-[3px] shadow-[0_0_0_999px_rgba(8,16,28,0.45)] ${ovalClass}`}
              />
            </div>
            {!ready && !fatal && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 px-6 text-center text-sm text-white">
                Starting camera and face check…
              </div>
            )}
          </div>

          {fatal && (
            <p className="rounded-2xl border border-[#ffd0cc] bg-[#fff5f4] px-4 py-3 text-sm text-[#ff4940]">
              {fatal}
            </p>
          )}
          {!fatal && glasses && (
            <p
              role="alert"
              className="rounded-2xl border border-[#ffd0cc] bg-[#fff5f4] px-4 py-3 text-sm text-[#ff4940]"
            >
              {read.message}
            </p>
          )}
          {!fatal && !glasses && (
            <p aria-live="polite" className="text-center text-sm text-slate-helper">
              {ready
                ? (read?.message ?? 'Position your face inside the oval.')
                : 'This stays on your device until you capture the photo.'}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ash px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-helper hover:text-portrait-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canCapture}
            onClick={() => {
              void capture();
            }}
            className="inline-flex items-center gap-2 rounded-full bg-portrait-ink px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            <Camera className="h-4 w-4" />
            {capturing ? 'Checking photo…' : 'Capture photo'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
