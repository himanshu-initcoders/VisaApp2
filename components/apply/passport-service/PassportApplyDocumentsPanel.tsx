'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Eye,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DocumentPreviewModal,
  type DocumentPreviewItem,
} from '@/components/apply/review/DocumentPreviewModal';
import {
  isPassportDocumentSlotRequired,
  type PassportApplyFormConfig,
} from '@/lib/apply/passportForm';
import type { PassportDraftUpload } from '@/lib/apply/passportDraftFiles';
import { resolveDocumentPreviewUrl } from '@/lib/apply/resolveDocumentPreview';

type Slot = PassportApplyFormConfig['documentSlots'][number];

function isImageMime(mimeType?: string, filename?: string) {
  if (mimeType?.startsWith('image/')) return true;
  if (mimeType === 'application/pdf') return false;
  if (filename && /\.pdf$/i.test(filename)) return false;
  return Boolean(mimeType?.startsWith('image/'));
}

function isPdfMime(mimeType?: string, filename?: string) {
  if (mimeType === 'application/pdf') return true;
  return Boolean(filename && /\.pdf$/i.test(filename));
}

function revokeBlobUrl(url?: string | null) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}

export function PassportApplyDocumentsPanel({
  slots,
  uploads,
  uploadBusyKey = null,
  isSignedIn = true,
  disabled,
  readOnly = false,
  onUpload,
  onRemove,
}: {
  slots: Slot[];
  uploads: Record<string, PassportDraftUpload>;
  uploadBusyKey?: string | null;
  isSignedIn?: boolean;
  disabled?: boolean;
  /** Review step: thumbnails + Preview only. */
  readOnly?: boolean;
  onUpload?: (slotKey: string, file: File) => void;
  onRemove?: (slotKey: string) => void;
}) {
  const [previewBySlot, setPreviewBySlot] = useState<
    Record<string, { url: string; mimeType?: string }>
  >({});
  const [loadingPreviewKey, setLoadingPreviewKey] = useState<string | null>(
    null
  );
  const [active, setActive] = useState<DocumentPreviewItem | null>(null);
  const localBlobRef = useRef<Map<string, string>>(new Map());

  // Resolve thumbnails from draft storage keys (after reload) or keep local blobs.
  useEffect(() => {
    let cancelled = false;
    const keys = Object.keys(uploads);

    void (async () => {
      for (const slotKey of keys) {
        const upload = uploads[slotKey];
        if (!upload) continue;
        if (localBlobRef.current.has(slotKey)) continue;
        if (previewBySlot[slotKey]?.url) continue;

        setLoadingPreviewKey(slotKey);
        const resolved = await resolveDocumentPreviewUrl({
          storageKey: upload.storageKey,
        });
        if (cancelled) return;
        if (resolved?.url) {
          setPreviewBySlot((prev) => ({
            ...prev,
            [slotKey]: {
              url: resolved.url,
              mimeType: resolved.mimeType || upload.mimeType,
            },
          }));
        }
        setLoadingPreviewKey((current) =>
          current === slotKey ? null : current
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-resolve when upload keys change
  }, [uploads]);

  useEffect(() => {
    return () => {
      for (const url of localBlobRef.current.values()) revokeBlobUrl(url);
      localBlobRef.current.clear();
      for (const entry of Object.values(previewBySlot)) {
        if (!localBlobRef.current.has(entry.url)) {
          // Server-resolved blobs also need revoke on unmount
        }
      }
      for (const entry of Object.values(previewBySlot)) {
        revokeBlobUrl(entry.url);
      }
    };
    // intentionally once on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rememberLocalPreview = (
    slotKey: string,
    file: File,
    previousUrl?: string
  ) => {
    revokeBlobUrl(previousUrl);
    const url = URL.createObjectURL(file);
    localBlobRef.current.set(slotKey, url);
    setPreviewBySlot((prev) => ({
      ...prev,
      [slotKey]: { url, mimeType: file.type || undefined },
    }));
  };

  const clearPreview = (slotKey: string) => {
    const local = localBlobRef.current.get(slotKey);
    revokeBlobUrl(local);
    localBlobRef.current.delete(slotKey);
    const existing = previewBySlot[slotKey]?.url;
    if (existing && existing !== local) revokeBlobUrl(existing);
    setPreviewBySlot((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  };

  const openPreview = async (slot: Slot, upload: PassportDraftUpload) => {
    const cached = previewBySlot[slot.key];
    if (cached?.url) {
      setActive({
        title: slot.label,
        name: upload.filename,
        previewUrl: cached.url,
        mimeType: cached.mimeType || upload.mimeType,
      });
      return;
    }

    setLoadingPreviewKey(slot.key);
    const resolved = await resolveDocumentPreviewUrl({
      storageKey: upload.storageKey,
    });
    setLoadingPreviewKey(null);
    if (!resolved?.url) return;

    setPreviewBySlot((prev) => ({
      ...prev,
      [slot.key]: {
        url: resolved.url,
        mimeType: resolved.mimeType || upload.mimeType,
      },
    }));
    setActive({
      title: slot.label,
      name: upload.filename,
      previewUrl: resolved.url,
      mimeType: resolved.mimeType || upload.mimeType,
    });
  };

  if (slots.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-ash-divider p-6 text-sm text-slate-helper">
        No documents required for this product yet. Continue to review.
      </p>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {slots.map((slot) => {
          const upload = uploads[slot.key];
          const required = isPassportDocumentSlotRequired(slot);
          const uploading = uploadBusyKey === slot.key;
          const preview = previewBySlot[slot.key];
          const image = isImageMime(
            preview?.mimeType || upload?.mimeType,
            upload?.filename
          );
          const previewLoading =
            loadingPreviewKey === slot.key && !preview?.url;

          return (
            <div
              key={slot.key}
              className="overflow-hidden rounded-[24px] border border-ash bg-white shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 px-4 pt-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-portrait-ink">
                    {slot.label}
                    {required ? (
                      <span className="text-[#ff4940]"> *</span>
                    ) : null}
                  </p>
                  {required ? (
                    <p className="mt-1 text-xs text-slate-helper">Required</p>
                  ) : null}
                </div>
                {upload ? (
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint-wash text-[#00a32a]">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </div>

              <div className="mx-4 mt-3 flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-[#f8fafc]">
                {uploading || previewLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-slate-helper" />
                ) : upload && image && preview?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview.url}
                    alt={slot.label}
                    className="h-full w-full object-contain p-2"
                  />
                ) : upload &&
                  preview?.url &&
                  isPdfMime(preview.mimeType || upload.mimeType, upload.filename) ? (
                  <iframe
                    title={`${slot.label} preview`}
                    src={`${preview.url}#page=1&view=FitH`}
                    className="h-full w-full border-0 bg-white"
                  />
                ) : upload ? (
                  <div className="flex flex-col items-center gap-2 px-4 text-center">
                    <FileText className="h-8 w-8 text-slate-helper" />
                    <p className="line-clamp-2 text-xs text-portrait-ink">
                      {upload.filename}
                    </p>
                  </div>
                ) : (
                  <p className="px-4 text-center text-xs text-slate-helper">
                    Not uploaded yet
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 px-4 py-4">
                {!readOnly ? (
                  <label
                    className={[
                      'inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#eef4ff] px-4 py-2 text-sm font-medium text-[#3b82f6] transition-colors hover:bg-[#dce8ff]',
                      disabled || uploading || !isSignedIn
                        ? 'pointer-events-none opacity-60'
                        : '',
                    ].join(' ')}
                  >
                    <Upload className="h-4 w-4" />
                    {upload ? 'Replace file' : 'Upload from device'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      disabled={disabled || uploading || !isSignedIn}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (!file || !onUpload) return;
                        rememberLocalPreview(
                          slot.key,
                          file,
                          previewBySlot[slot.key]?.url
                        );
                        onUpload(slot.key, file);
                      }}
                    />
                  </label>
                ) : null}

                {upload ? (
                  <button
                    type="button"
                    disabled={disabled || uploading || previewLoading}
                    onClick={() => void openPreview(slot, upload)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#eef4ff] px-3 py-2 text-sm font-medium text-[#3b82f6] transition-colors hover:bg-[#dce8ff] disabled:opacity-60"
                  >
                    {previewLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    Preview
                  </button>
                ) : null}

                {!readOnly && upload && isSignedIn && onRemove ? (
                  <button
                    type="button"
                    disabled={disabled || uploading}
                    onClick={() => {
                      clearPreview(slot.key);
                      onRemove(slot.key);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-ash px-3 py-2 text-sm text-slate-helper transition-colors hover:border-[#ff4940] hover:text-[#ff4940] disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                ) : null}
              </div>

              {!readOnly && !isSignedIn ? (
                <p className="px-4 pb-4 text-xs text-slate-helper">
                  Sign in to upload documents.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <DocumentPreviewModal
        open={Boolean(active)}
        item={active}
        onClose={() => setActive(null)}
      />
    </>
  );
}
