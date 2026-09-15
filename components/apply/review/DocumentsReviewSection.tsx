'use client';

import { useState } from 'react';
import { Eye, FileText, ImageOff } from 'lucide-react';
import {
  DocumentPreviewModal,
  type DocumentPreviewItem,
} from '@/components/apply/review/DocumentPreviewModal';
import type {
  ApplyDocumentSlot,
  TravellerDocumentUpload,
} from '@/lib/apply/applicationForm';

interface DocumentsReviewSectionProps {
  slots: ApplyDocumentSlot[];
  uploads: TravellerDocumentUpload[];
  passportPreviewUrl?: string;
  passportBackPreviewUrl?: string;
}

function isImagePreview(item: DocumentPreviewItem) {
  return Boolean(
    item.mimeType?.startsWith('image/') ||
      /^data:image\//.test(item.previewUrl) ||
      /\.(jpe?g|png|webp|gif)$/i.test(item.name || item.previewUrl)
  );
}

export function DocumentsReviewSection({
  slots,
  uploads,
  passportPreviewUrl,
  passportBackPreviewUrl,
}: DocumentsReviewSectionProps) {
  const [active, setActive] = useState<DocumentPreviewItem | null>(null);
  const byKey = new Map(uploads.map((item) => [item.key, item]));

  const items: Array<
    | (DocumentPreviewItem & { missing?: false })
    | { title: string; missing: true; required?: boolean }
  > = [
    ...(passportPreviewUrl
      ? [
          {
            title: 'Passport bio page',
            name: 'Passport front',
            previewUrl: passportPreviewUrl,
            mimeType: 'image/*',
          },
        ]
      : [
          {
            title: 'Passport bio page',
            missing: true as const,
            required: true,
          },
        ]),
    ...(passportBackPreviewUrl
      ? [
          {
            title: 'Passport back page',
            name: 'Passport back',
            previewUrl: passportBackPreviewUrl,
            mimeType: 'image/*',
          },
        ]
      : []),
    ...slots.map((slot) => {
      const upload = byKey.get(slot.key);
      if (upload) {
        return {
          title: slot.title,
          name: upload.name,
          previewUrl: upload.previewUrl,
          mimeType: upload.mimeType,
        };
      }
      return {
        title: slot.title,
        missing: true as const,
        required: slot.required,
      };
    }),
  ];

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-helper">No documents required for this visa.</p>
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
                  onClick={() => setActive(item)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eef4ff] px-3 py-1.5 text-xs font-medium text-[#3b82f6] transition-colors hover:bg-[#dce8ff]"
                >
                  <Eye className="h-3.5 w-3.5" />
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
