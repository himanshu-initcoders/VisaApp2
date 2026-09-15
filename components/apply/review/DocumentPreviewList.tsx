'use client';

import { useState } from 'react';
import { Eye, FileText } from 'lucide-react';
import {
  DocumentPreviewModal,
  type DocumentPreviewItem,
} from '@/components/apply/review/DocumentPreviewModal';

interface DocumentPreviewListProps {
  items: DocumentPreviewItem[];
}

function isImagePreview(item: DocumentPreviewItem) {
  return Boolean(
    item.mimeType?.startsWith('image/') ||
      /^data:image\//.test(item.previewUrl) ||
      /\.(jpe?g|png|webp|gif)$/i.test(item.name || item.previewUrl)
  );
}

export function DocumentPreviewList({ items }: DocumentPreviewListProps) {
  const [active, setActive] = useState<DocumentPreviewItem | null>(null);

  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-helper">No documents uploaded yet.</p>
    );
  }

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item, index) => {
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
