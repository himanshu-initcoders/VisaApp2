'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, FileText, ImageOff, Loader2 } from 'lucide-react';
import { PdfFirstPageThumbnail } from '@/components/apply/PdfFirstPageThumbnail';
import {
  DocumentPreviewModal,
  type DocumentPreviewItem,
} from '@/components/apply/review/DocumentPreviewModal';
import type {
  ApplyDocumentSlot,
  TravellerDocumentUpload,
} from '@/lib/apply/applicationForm';
import { isDocumentSlotFilled } from '@/lib/apply/applicationForm';
import {
  PASSPORT_BACK_SLOT,
  PASSPORT_FRONT_SLOT,
} from '@/lib/apply/idbDraftStorage';
import { isPassportBackDocument } from '@/lib/document-types';
import { isPdfPreviewSource } from '@/lib/apply/pdfFirstPagePreview';
import { resolveDocumentPreviewUrl } from '@/lib/apply/resolveDocumentPreview';
import type { DraftFileRef } from '@/lib/apply/types';

/** If bytes are PDF but the stored name still ends in .jpg, show a .pdf label. */
function displayNameForMime(name: string | undefined, mimeType?: string) {
  if (!name) return name;
  if (mimeType === 'application/pdf' && /\.(jpe?g|png|webp)$/i.test(name)) {
    return name.replace(/\.[^.]+$/i, '.pdf');
  }
  return name;
}

interface DocumentsReviewSectionProps {
  slots: ApplyDocumentSlot[];
  uploads: TravellerDocumentUpload[];
  passportPreviewUrl?: string;
  passportBackPreviewUrl?: string;
  passportFrontMimeType?: string;
  passportBackMimeType?: string;
  passportFrontFilename?: string;
  passportBackFilename?: string;
  /** Needed to rehydrate draft previews from IndexedDB / server. */
  listingId?: string;
  travellerId?: string;
  draftFileRefs?: DraftFileRef[];
  ownerUserId?: string;
  sessionUserId?: string | null;
}

type PreviewCard =
  | (DocumentPreviewItem & {
      missing?: false;
      slotKey?: string;
      storageKey?: string;
      storageUrl?: string;
    })
  | { title: string; missing: true; required?: boolean };

type ResolvedPreview = { url: string; mimeType?: string };

function isPdfPreview(item: DocumentPreviewItem) {
  // Filename wins — storage keys often keep a leftover `.jpg` mime for PDFs.
  return isPdfPreviewSource(item.mimeType, item.name);
}

function isImagePreview(item: DocumentPreviewItem) {
  if (!item.previewUrl) return false;
  if (isPdfPreview(item)) return false;
  return Boolean(
    item.mimeType?.startsWith('image/') ||
      /^data:image\//.test(item.previewUrl) ||
      /\.(jpe?g|png|webp|gif)$/i.test(item.name || item.previewUrl)
  );
}

function refForSlot(refs: DraftFileRef[] | undefined, slotKey: string) {
  return refs?.find((ref) => ref.slotKey === slotKey);
}

function resolveSignature(item: PreviewCard & { missing?: false }) {
  return [
    item.slotKey || item.title,
    item.previewUrl || '',
    item.storageKey || '',
    item.storageUrl || '',
    item.mimeType || '',
  ].join('|');
}

export function DocumentsReviewSection({
  slots,
  uploads,
  passportPreviewUrl,
  passportBackPreviewUrl,
  passportFrontMimeType,
  passportBackMimeType,
  passportFrontFilename,
  passportBackFilename,
  listingId,
  travellerId,
  draftFileRefs,
  ownerUserId,
  sessionUserId = null,
}: DocumentsReviewSectionProps) {
  const [active, setActive] = useState<DocumentPreviewItem | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [resolvedByKey, setResolvedByKey] = useState<
    Record<string, ResolvedPreview>
  >({});
  const [resolvingKeys, setResolvingKeys] = useState<Record<string, boolean>>(
    {}
  );
  const previewCacheRef = useRef<Map<string, ResolvedPreview>>(new Map());
  const resolvedSigRef = useRef<Map<string, string>>(new Map());
  const byKey = useMemo(
    () => new Map(uploads.map((item) => [item.key, item])),
    [uploads]
  );

  useEffect(() => {
    const cache = previewCacheRef.current;
    return () => {
      for (const entry of cache.values()) {
        if (entry.url.startsWith('blob:')) URL.revokeObjectURL(entry.url);
      }
      cache.clear();
      resolvedSigRef.current.clear();
    };
  }, []);

  const frontRef = refForSlot(draftFileRefs, PASSPORT_FRONT_SLOT);
  const backRef = refForSlot(draftFileRefs, PASSPORT_BACK_SLOT);

  // Passport back is captured in the passport step (or documents slot). Never
  // also list it as a separate empty required slot — that caused "Not uploaded"
  // even when passportBackUrl / IDB back already existed.
  const passportBackSlot = slots.find((slot) => isPassportBackDocument(slot));
  const otherSlots = slots.filter((slot) => !isPassportBackDocument(slot));
  const backUpload =
    (passportBackSlot && byKey.get(passportBackSlot.key)) ||
    byKey.get(PASSPORT_BACK_SLOT);
  const backFilled =
    Boolean(passportBackPreviewUrl?.trim()) ||
    Boolean(backRef) ||
    isDocumentSlotFilled(backUpload);

  const items: PreviewCard[] = [
    ...(passportPreviewUrl || frontRef
      ? [
          {
            title: 'Passport bio page',
            name:
              passportFrontFilename ||
              frontRef?.filename ||
              'Passport front',
            previewUrl: passportPreviewUrl || frontRef?.url || '',
            mimeType:
              passportFrontMimeType ||
              frontRef?.mimeType ||
              'image/jpeg',
            slotKey: PASSPORT_FRONT_SLOT,
            storageKey: frontRef?.storageKey,
            storageUrl: frontRef?.url,
          },
        ]
      : [
          {
            title: 'Passport bio page',
            missing: true as const,
            required: true,
          },
        ]),
    ...(backFilled
      ? [
          {
            title: passportBackSlot?.title || 'Passport back page',
            name:
              passportBackFilename ||
              backUpload?.name ||
              backRef?.filename ||
              'Passport back',
            previewUrl:
              passportBackPreviewUrl ||
              backUpload?.previewUrl ||
              backUpload?.storageUrl ||
              backRef?.url ||
              '',
            mimeType:
              passportBackMimeType ||
              backUpload?.mimeType ||
              backRef?.mimeType ||
              'image/jpeg',
            slotKey: PASSPORT_BACK_SLOT,
            storageKey: backUpload?.storageKey || backRef?.storageKey,
            storageUrl: backUpload?.storageUrl || backRef?.url,
          },
        ]
      : passportBackSlot
        ? [
            {
              title: passportBackSlot.title,
              missing: true as const,
              required: passportBackSlot.required,
            },
          ]
        : []),
    ...otherSlots.map((slot) => {
      const upload = byKey.get(slot.key);
      const ref = refForSlot(draftFileRefs, slot.key);
      if (
        upload &&
        (upload.previewUrl ||
          upload.storageUrl ||
          upload.storageKey ||
          upload.storedInIdb ||
          upload.name ||
          ref)
      ) {
        return {
          title: slot.title,
          name: upload.name || ref?.filename,
          previewUrl: upload.previewUrl || upload.storageUrl || ref?.url || '',
          mimeType: upload.mimeType || ref?.mimeType,
          slotKey: slot.key,
          storageKey: upload.storageKey || ref?.storageKey,
          storageUrl: upload.storageUrl || ref?.url,
        };
      }
      return {
        title: slot.title,
        missing: true as const,
        required: slot.required,
      };
    }),
  ];

  const resolveKey = useMemo(
    () =>
      items
        .filter(
          (item): item is PreviewCard & { missing?: false } =>
            !('missing' in item && item.missing)
        )
        .map((item) => resolveSignature(item))
        .join('||'),
    [items]
  );

  // After refresh, blob: URLs die — rehydrate thumbs from IDB / draft-files.
  useEffect(() => {
    let cancelled = false;
    const filled = items.filter(
      (item): item is PreviewCard & { missing?: false } =>
        !('missing' in item && item.missing)
    );

    void (async () => {
      for (const item of filled) {
        const key = item.slotKey || item.title;
        const signature = resolveSignature(item);
        if (resolvedSigRef.current.get(key) === signature) continue;

        setResolvingKeys((prev) =>
          prev[key] ? prev : { ...prev, [key]: true }
        );

        const resolved = await resolveDocumentPreviewUrl({
          listingId,
          travellerId,
          slotKey: item.slotKey,
          storageKey: item.storageKey,
          ownerUserId,
          sessionUserId,
          previewUrl: item.previewUrl,
          storageUrl: item.storageUrl,
          filename: item.name,
        });

        if (cancelled) {
          // Leave the blob alone — View may have raced and adopted this URL.
          return;
        }

        if (resolved?.url) {
          // Do not revoke previous blob URLs here — thumbnails / an open View
          // modal may still be using them. Cleanup happens on unmount only.
          const entry = {
            url: resolved.url,
            mimeType: resolved.mimeType || item.mimeType,
          };
          previewCacheRef.current.set(key, entry);
          resolvedSigRef.current.set(key, signature);
          setResolvedByKey((prev) => ({ ...prev, [key]: entry }));
        } else {
          resolvedSigRef.current.set(key, signature);
        }

        setResolvingKeys((prev) => {
          if (!prev[key]) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // resolveKey captures item identity; listing/session drive storage lookup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveKey, listingId, travellerId, ownerUserId, sessionUserId]);

  const openPreview = async (item: PreviewCard & { missing?: false }) => {
    if ('missing' in item && item.missing) return;
    const key = item.slotKey || item.title;
    setLoadingKey(key);
    try {
      const ref = item.slotKey
        ? refForSlot(draftFileRefs, item.slotKey)
        : undefined;
      const storageKey = item.storageKey || ref?.storageKey;
      const storageUrl = item.storageUrl || ref?.url;
      // Fresh resolve only — never open the modal with a cached blob: URL.
      // Those are often revoked by draft rehydrate right after refresh/edit.
      const resolved = await resolveDocumentPreviewUrl({
        listingId,
        travellerId,
        slotKey: item.slotKey,
        storageKey,
        ownerUserId,
        sessionUserId,
        previewUrl: item.previewUrl,
        storageUrl,
        filename: item.name || ref?.filename,
      });
      if (!resolved) {
        setActive({
          title: item.title,
          name: item.name,
          previewUrl: '',
          mimeType: item.mimeType || ref?.mimeType,
        });
        return;
      }
      const entry = {
        url: resolved.url,
        mimeType: resolved.mimeType || item.mimeType || ref?.mimeType,
      };
      previewCacheRef.current.set(key, entry);
      resolvedSigRef.current.set(key, resolveSignature(item));
      setResolvedByKey((prev) => ({ ...prev, [key]: entry }));
      setActive({
        title: item.title,
        name: displayNameForMime(item.name, entry.mimeType),
        previewUrl: entry.url,
        mimeType: entry.mimeType,
      });
    } finally {
      setLoadingKey(null);
    }
  };

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-helper">
        No documents required for this visa.
      </p>
    );
  }

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item, index) => {
          if ('missing' in item && item.missing) {
            return (
              <li
                key={`missing-${item.title}-${index}`}
                className="overflow-hidden rounded-[20px] border border-dashed border-ash bg-[#fafbfd]"
              >
                <div className="flex h-36 flex-col items-center justify-center gap-2 px-4 text-center">
                  <ImageOff className="h-8 w-8 text-slate-helper" />
                  <p className="text-xs text-slate-helper">
                    {item.required ? 'Not uploaded' : 'Optional · not uploaded'}
                  </p>
                </div>
                <div className="border-t border-ash px-3 py-2.5">
                  <p className="truncate text-sm font-medium text-portrait-ink">
                    {item.title}
                    {item.required && (
                      <span className="text-[#ff4940]"> *</span>
                    )}
                  </p>
                </div>
              </li>
            );
          }

          const key = item.slotKey || item.title;
          const resolved = resolvedByKey[key];
          const displayMime = resolved?.mimeType || item.mimeType;
          const displayItem: DocumentPreviewItem = {
            title: item.title,
            name: displayNameForMime(item.name, displayMime),
            previewUrl: resolved?.url || item.previewUrl,
            mimeType: displayMime,
          };
          // Sniffed mime from resolve wins — never put PDF bytes in <img>.
          const pdf =
            isPdfPreview(displayItem) ||
            displayItem.mimeType === 'application/pdf';
          const image = !pdf && isImagePreview(displayItem);
          const thumbLoading = Boolean(resolvingKeys[key]) && !resolved?.url;
          const canView = Boolean(
            resolved?.url ||
              item.previewUrl ||
              item.storageUrl ||
              item.storageKey ||
              (listingId && travellerId && item.slotKey)
          );
          const busy = loadingKey === key;

          return (
            <li
              key={`${item.title}-${item.name ?? 'file'}-${index}`}
              className="overflow-hidden rounded-[20px] border border-ash bg-white"
            >
              <div className="flex h-36 items-center justify-center bg-[#f8fafc]">
                {thumbLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-slate-helper" />
                ) : image && displayItem.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayItem.previewUrl}
                    alt={item.title}
                    className="h-full w-full object-contain p-2"
                    onError={(event) => {
                      // Hide broken thumb; View still resolves from IDB/server
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : pdf && displayItem.previewUrl ? (
                  <PdfFirstPageThumbnail
                    src={displayItem.previewUrl}
                    alt={item.title}
                    fallbackName={displayItem.name || 'Document'}
                    className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center"
                    imgClassName="h-full w-full object-contain p-2"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 px-4 text-center">
                    <FileText className="h-8 w-8 text-slate-helper" />
                    <p className="line-clamp-2 text-xs text-portrait-ink">
                      {displayItem.name || 'Document'}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-ash px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-portrait-ink">
                    {item.title}
                  </p>
                  {displayItem.name && (
                    <p className="truncate text-[11px] text-slate-helper">
                      {displayItem.name}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!canView || busy}
                  onClick={() => void openPreview(item)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eef4ff] px-3 py-1.5 text-xs font-medium text-[#3b82f6] transition-colors hover:bg-[#dce8ff] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  View
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <DocumentPreviewModal
        open={Boolean(active)}
        item={active}
        onClose={() => setActive(null)}
      />
    </>
  );
}
