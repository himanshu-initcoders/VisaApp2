'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/admin/Pagination';
import {
  createDocumentType,
  updateDocumentTypeLabel,
  uploadOrReplaceSampleDocument,
} from '@/app/(admin)/admin/config/document-types/actions';
import { Download, FileText, Pencil, Plus, Search, Upload, X } from 'lucide-react';

const DEFAULT_PAGE_SIZE = 25;

export type DocumentTypeRow = {
  id: string;
  value: string;
  label: string;
  sampleDocumentUrl: string | null;
  sampleDocumentFilename: string | null;
  sampleDocumentMimeType: string | null;
  sortOrder: number;
};

function slugifyLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-portrait-ink/40"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-ash-divider bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2
            className="text-2xl font-medium text-portrait-ink"
            style={{ fontFamily: 'Basier Circle', letterSpacing: '-0.5px' }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-helper transition-colors hover:bg-sky-wash/40 hover:text-portrait-ink"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export function DocumentTypesManager({
  initialTypes,
}: {
  initialTypes: DocumentTypeRow[];
}) {
  const router = useRouter();
  const [types, setTypes] = useState(initialTypes);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentTypeRow | null>(null);
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetId = useRef<string | null>(null);

  useEffect(() => {
    setTypes(initialTypes);
  }, [initialTypes]);

  const withSampleCount = useMemo(
    () => types.filter((t) => Boolean(t.sampleDocumentUrl)).length,
    [types]
  );

  const filteredTypes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return types;
    return types.filter((row) => {
      const haystack = [
        row.label,
        row.value,
        row.sampleDocumentFilename ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [types, search]);

  const totalPages = Math.max(1, Math.ceil(filteredTypes.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedTypes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTypes.slice(start, start + itemsPerPage);
  }, [filteredTypes, currentPage, itemsPerPage]);

  const openAdd = () => {
    setLabel('');
    setValue('');
    setSlugTouched(false);
    setError(null);
    setAddOpen(true);
  };

  const openEdit = (row: DocumentTypeRow) => {
    setEditing(row);
    setLabel(row.label);
    setError(null);
  };

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await createDocumentType({ label, value });
      if ('error' in result && result.error) {
        setError(result.error);
        return;
      }
      if (result.success && result.documentType) {
        setTypes((prev) => [
          ...prev,
          {
            id: result.documentType.id,
            value: result.documentType.value,
            label: result.documentType.label,
            sampleDocumentUrl: result.documentType.sampleDocumentUrl,
            sampleDocumentFilename: result.documentType.sampleDocumentFilename,
            sampleDocumentMimeType: result.documentType.sampleDocumentMimeType,
            sortOrder: result.documentType.sortOrder,
          },
        ]);
        setAddOpen(false);
        router.refresh();
      }
    } catch {
      setError('Failed to create document type');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateLabel = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const result = await updateDocumentTypeLabel({ id: editing.id, label });
      if ('error' in result && result.error) {
        setError(result.error);
        return;
      }
      if (result.success && result.documentType) {
        setTypes((prev) =>
          prev.map((row) =>
            row.id === result.documentType.id
              ? { ...row, label: result.documentType.label }
              : row
          )
        );
        setEditing(null);
        router.refresh();
      }
    } catch {
      setError('Failed to update document type');
    } finally {
      setBusy(false);
    }
  };

  const pickSample = (id: string) => {
    uploadTargetId.current = id;
    fileInputRef.current?.click();
  };

  const handleSampleSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    const targetId = uploadTargetId.current;
    event.target.value = '';
    if (!file || !targetId) return;

    setUploadingId(targetId);
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Array.from(new Uint8Array(arrayBuffer));
      const result = await uploadOrReplaceSampleDocument(targetId, {
        buffer,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });

      if ('error' in result && result.error) {
        alert(result.error);
        return;
      }

      if (result.success && result.documentType) {
        setTypes((prev) =>
          prev.map((row) =>
            row.id === result.documentType.id
              ? {
                  ...row,
                  sampleDocumentUrl: result.documentType.sampleDocumentUrl,
                  sampleDocumentFilename:
                    result.documentType.sampleDocumentFilename,
                  sampleDocumentMimeType:
                    result.documentType.sampleDocumentMimeType,
                }
              : row
          )
        );
        if (editing?.id === result.documentType.id) {
          setEditing((prev) =>
            prev
              ? {
                  ...prev,
                  sampleDocumentUrl: result.documentType.sampleDocumentUrl,
                  sampleDocumentFilename:
                    result.documentType.sampleDocumentFilename,
                  sampleDocumentMimeType:
                    result.documentType.sampleDocumentMimeType,
                }
              : prev
          );
        }
        router.refresh();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingId(null);
      uploadTargetId.current = null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-3xl border border-ash-divider bg-white p-6">
          <p className="mb-1 text-sm text-slate-helper">Total types</p>
          <p
            className="text-[44px] font-medium text-portrait-ink"
            style={{ fontFamily: 'Basier Circle' }}
          >
            {types.length}
          </p>
        </div>
        <div className="rounded-3xl border border-ash-divider bg-white p-6">
          <p className="mb-1 text-sm text-slate-helper">With sample</p>
          <p
            className="text-[44px] font-medium text-portrait-ink"
            style={{ fontFamily: 'Basier Circle' }}
          >
            {withSampleCount}
          </p>
        </div>
        <div className="flex items-center justify-end md:col-span-1">
          <Button variant="primary" size="md" onClick={openAdd}>
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add document type
            </span>
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={handleSampleSelected}
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-helper" />
        <Input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setCurrentPage(1);
          }}
          placeholder="Search by name, slug, or sample file…"
          className="pl-10"
          aria-label="Search document types"
        />
      </div>

      <div className="overflow-hidden rounded-3xl border border-ash-divider bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ash-divider bg-[#f8fafc] text-left text-sm text-slate-helper">
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Slug</th>
                <th className="px-6 py-4 font-medium">Sample</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedTypes.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-12 text-center text-sm text-slate-helper"
                  >
                    {search.trim()
                      ? `No document types match “${search.trim()}”.`
                      : 'No document types yet.'}
                  </td>
                </tr>
              ) : (
                pagedTypes.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-ash-divider last:border-0"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-portrait-ink">
                      {row.label}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-helper">
                      {row.value}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-helper">
                      {row.sampleDocumentFilename ? (
                        <span className="inline-flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="max-w-[180px] truncate">
                            {row.sampleDocumentFilename}
                          </span>
                        </span>
                      ) : (
                        'None'
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-ash px-3 py-1.5 text-sm text-portrait-ink transition-colors hover:bg-sky-wash/30"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={uploadingId === row.id}
                          onClick={() => pickSample(row.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-ash px-3 py-1.5 text-sm text-portrait-ink transition-colors hover:bg-sky-wash/30 disabled:opacity-60"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {uploadingId === row.id
                            ? 'Uploading…'
                            : row.sampleDocumentUrl
                              ? 'Replace sample'
                              : 'Upload sample'}
                        </button>
                        {row.sampleDocumentUrl && (
                          <a
                            href={row.sampleDocumentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full border border-ash px-3 py-1.5 text-sm text-portrait-ink transition-colors hover:bg-sky-wash/30"
                          >
                            <Download className="h-3.5 w-3.5" />
                            View
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredTypes.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          totalItems={filteredTypes.length}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(limit) => {
            setItemsPerPage(limit);
            setCurrentPage(1);
          }}
        />
      )}

      {addOpen && (
        <ModalShell title="Add document type" onClose={() => setAddOpen(false)}>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-portrait-ink">
                Display name
              </label>
              <Input
                value={label}
                onChange={(event) => {
                  const next = event.target.value;
                  setLabel(next);
                  if (!slugTouched) setValue(slugifyLabel(next));
                }}
                placeholder="e.g. Bank statements (3–6 months)"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-portrait-ink">
                Slug
              </label>
              <Input
                value={value}
                onChange={(event) => {
                  setSlugTouched(true);
                  setValue(
                    event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, '')
                  );
                }}
                placeholder="bank_statements"
              />
              <p className="mt-1 text-xs text-slate-helper">
                Fixed after create. Use lowercase letters, numbers, underscores.
              </p>
            </div>
            {error && <p className="text-sm text-[#ff4940]">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setAddOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleCreate}
                disabled={busy || !label.trim() || !value.trim()}
              >
                {busy ? 'Saving…' : 'Create'}
              </Button>
            </div>
          </div>
        </ModalShell>
      )}

      {editing && (
        <ModalShell
          title="Edit document type"
          onClose={() => setEditing(null)}
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-portrait-ink">
                Display name
              </label>
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-portrait-ink">
                Slug
              </label>
              <Input value={editing.value} disabled />
              <p className="mt-1 text-xs text-slate-helper">
                Slug cannot be changed after create.
              </p>
            </div>
            <div className="rounded-2xl border border-ash-divider bg-[#f8fafc] p-4">
              <p className="mb-2 text-sm font-medium text-portrait-ink">
                Sample document
              </p>
              {editing.sampleDocumentFilename ? (
                <p className="mb-3 truncate text-xs text-slate-helper">
                  {editing.sampleDocumentFilename}
                </p>
              ) : (
                <p className="mb-3 text-xs text-slate-helper">
                  No sample uploaded yet.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={uploadingId === editing.id}
                  onClick={() => pickSample(editing.id)}
                >
                  {uploadingId === editing.id
                    ? 'Uploading…'
                    : editing.sampleDocumentUrl
                      ? 'Replace sample'
                      : 'Upload sample'}
                </Button>
                {editing.sampleDocumentUrl && (
                  <a
                    href={editing.sampleDocumentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full border border-portrait-ink px-3 py-1.5 text-sm font-medium text-portrait-ink"
                  >
                    Download sample
                  </a>
                )}
              </div>
            </div>
            {error && <p className="text-sm text-[#ff4940]">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setEditing(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleUpdateLabel}
                disabled={busy || !label.trim()}
              >
                {busy ? 'Saving…' : 'Save name'}
              </Button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
