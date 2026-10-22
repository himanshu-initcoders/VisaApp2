'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, FileText, ImageOff, Loader2 } from 'lucide-react';
import {
  DocumentPreviewModal,
  type DocumentPreviewItem,
} from '@/components/apply/review/DocumentPreviewModal';
import type {
  ApplyDocumentSlot,
  TravellerDocumentUpload,
} from '@/lib/apply/applicationForm';
import {
  PASSPORT_BACK_SLOT,
  PASSPORT_FRONT_SLOT,
} from '@/lib/apply/idbDraftStorage';
import { resolveDocumentPreviewUrl } from '@/lib/apply/resolveDocumentPreview';
import type { DraftFileRef } from '@/lib/apply/types';

interface DocumentsReviewSectionProps {
  slots: ApplyDocumentSlot[];
  uploads: TravellerDocumentUpload[];
  passportPreviewUrl?: string;
  passportBackPreviewUrl?: string;
  /** Needed to rehydrate draft previews from IndexedDB / server. */
  listingId?: string;
  travellerId?: string;
  draftFileRefs?: DraftFileRef[];
  ownerUserId?: string;
}

type PreviewCard =
  | (DocumentPreviewItem & {
      missing?: false;
      slotKey?: string;
      storageKey?: string;
      storageUrl?: string;
    })
  | { title: string; missing: true; required?: boolean };

function isImagePreview(item: DocumentPreviewItem) {
  if (!item.previewUrl) return false;
  return Boolean(
    item.mimeType?.startsWith('image/') ||
      /^data:image\//.test(item.previewUrl) ||
      /\.(jpe?g|png|webp|gif)$/i.test(item.name || item.previewUrl)
  );
}

function refForSlot(refs: DraftFileRef[] | undefined, slotKey: string) {
  return refs?.find((ref) => ref.slotKey === slotKey);
}

export function DocumentsReviewSection({
  slots,
  uploads,
  passportPreviewUrl,
  passportBackPreviewUrl,
  listingId,
  travellerId,
  draftFileRefs,
  ownerUserId,
}: DocumentsReviewSectionProps) {
  const [active, setActive] = useState<DocumentPreviewItem | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const previewCacheRef = useRef<Map<string, string>>(new Map());
  const byKey = new Map(uploads.map((item) => [item.key, item]));

  useEffect(() => {
    const cache = previewCacheRef.current;
    return () => {
      for (const url of cache.values()) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      }
      cache.clear();
    };
  }, []);

  const frontRef = refForSlot(draftFileRefs, PASSPORT_FRONT_SLOT);
  const backRef = refForSlot(draftFileRefs, PASSPORT_BACK_SLOT);

  const items: PreviewCard[] = [
    ...(passportPreviewUrl || frontRef
      ? [
          {
            title: 'Passport bio page',
            name: frontRef?.filename || 'Passport front',
            previewUrl: passportPreviewUrl || frontRef?.url || '',
            mimeType: frontRef?.mimeType || 'image/jpeg',
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
    ...(passportBackPreviewUrl || backRef
      ? [
          {
            title: 'Passport back page',
            name: backRef?.filename || 'Passport back',
            previewUrl: passportBackPreviewUrl || backRef?.url || '',
            mimeType: backRef?.mimeType || 'image/jpeg',
            slotKey: PASSPORT_BACK_SLOT,
            storageKey: backRef?.storageKey,
            storageUrl: backRef?.url,
          },
        ]
      : []),
    ...slots.map((slot) => {
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

  const openPreview = async (item: PreviewCard & { missing?: false }) => {
    if ('missing' in item && item.missing) return;
    const key = item.slotKey || item.title;
    setLoadingKey(key);
    try {
      const cached = previewCacheRef.current.get(key);
      if (cached) {
        setActive({
          title: item.title,
          name: item.name,
          previewUrl: cached,
          mimeType: item.mimeType,
        });
        return;
      }

      const resolved = await resolveDocumentPreviewUrl({
        listingId,
        travellerId,
        slotKey: item.slotKey,
        storageKey: item.storageKey,
        ownerUserId,
        previewUrl: item.previewUrl,
        storageUrl: item.storageUrl,
      });
      if (!resolved) {
        setActive({
          title: item.title,
          name: item.name,
          previewUrl: item.previewUrl || '',
          mimeType: item.mimeType,
        });
        return;
      }
      if (resolved.url.startsWith('blob:')) {
        const previous = previewCacheRef.current.get(key);
        if (previous && previous.startsWith('blob:')) {
          URL.revokeObjectURL(previous);
        }
        previewCacheRef.current.set(key, resolved.url);
      }
      setActive({
        title: item.title,
        name: item.name,
        previewUrl: resolved.url,
        mimeType: resolved.mimeType || item.mimeType,
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

          const image = isImagePreview(item);
          const canView = Boolean(
            item.previewUrl ||
              item.storageUrl ||
              item.storageKey ||
              (listingId && travellerId && item.slotKey)
          );
          const busy = loadingKey === (item.slotKey || item.title);

          return (
            <li
              key={`${item.title}-${item.name ?? 'file'}-${index}`}
              className="overflow-hidden rounded-[20px] border border-ash bg-white"
            >
              <div className="flex h-36 items-center justify-center bg-[#f8fafc]">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt={item.title}
                    className="h-full w-full object-contain p-2"
                    onError={(event) => {
                      // Hide broken thumb; View still resolves from IDB/server
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 px-4 text-center">
                    <FileText className="h-8 w-8 text-slate-helper" />
                    <p className="line-clamp-2 text-xs text-portrait-ink">
                      {item.name || 'Document'}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-ash px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-portrait-ink">
                    {item.title}
                  </p>
                  {item.name && (
                    <p className="truncate text-[11px] text-slate-helper">
                      {item.name}
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
