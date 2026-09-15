'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createComponents,
  updateComponent,
} from '@/app/(admin)/admin/config/visa-listings/actions';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import {
  DOCUMENT_TYPES,
  documentTypeLabel,
  isDocumentTypeValue,
  type DocumentTypeValue,
} from '@/lib/document-types';
import { Search, X } from 'lucide-react';

interface Component {
  id: string;
  visaListingId: string;
  key: string;
  documentType?: string | null;
  label?: string | null;
  amount: string | null;
  chargeable: boolean | null;
  familyEnabled: boolean | null;
  onlyB2b: boolean | null;
  toggle: boolean | null;
  attributes: string[] | null;
  sourceUrl: string | null;
  sortOrder: number;
  createdAt: Date;
}

interface ComponentFormModalProps {
  processId: string;
  initialData: Component | null;
  /** Document types already on this listing (skip in add mode) */
  existingDocumentTypes?: string[];
  onClose: () => void;
  onSuccess: (components: Component | Component[]) => void;
}

function resolveDocumentType(component: Component | null): DocumentTypeValue {
  if (!component) return 'passport';
  if (component.documentType && isDocumentTypeValue(component.documentType)) {
    return component.documentType;
  }
  if (isDocumentTypeValue(component.key)) {
    return component.key;
  }
  return 'passport';
}

function mapCreated(component: {
  id: string;
  visaListingId: string;
  key: string;
  documentType: string | null;
  label: string | null;
  amount: string | null;
  chargeable: boolean | null;
  familyEnabled: boolean | null;
  onlyB2b: boolean | null;
  toggle: boolean | null;
  attributes: unknown;
  sourceUrl: string | null;
  sortOrder: number;
  createdAt: Date;
}): Component {
  return {
    id: component.id,
    visaListingId: component.visaListingId,
    key: component.key,
    documentType: component.documentType,
    label: component.label,
    amount: String(component.amount ?? '0'),
    chargeable: component.chargeable ?? false,
    familyEnabled: component.familyEnabled ?? false,
    onlyB2b: component.onlyB2b ?? false,
    toggle: component.toggle ?? false,
    attributes: (component.attributes as string[]) || [],
    sourceUrl: component.sourceUrl,
    sortOrder: component.sortOrder,
    createdAt: component.createdAt,
  };
}

/**
 * ComponentFormModal — searchable multi-select for add; single type for edit.
 */
export function ComponentFormModal({
  processId,
  initialData,
  existingDocumentTypes = [],
  onClose,
  onSuccess,
}: ComponentFormModalProps) {
  const isEditMode = !!initialData;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DocumentTypeValue[]>(() =>
    isEditMode ? [resolveDocumentType(initialData)] : []
  );
  const [error, setError] = useState<string | null>(null);

  const alreadyAdded = useMemo(
    () => new Set(existingDocumentTypes.filter(Boolean)),
    [existingDocumentTypes]
  );

  useEffect(() => {
    setMounted(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSubmitting, onClose]);

  const filteredTypes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return DOCUMENT_TYPES;
    return DOCUMENT_TYPES.filter(
      (type) =>
        type.label.toLowerCase().includes(query) ||
        type.value.toLowerCase().includes(query)
    );
  }, [search]);

  const toggleType = (value: DocumentTypeValue) => {
    setError(null);
    if (isEditMode) {
      setSelected([value]);
      return;
    }
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const clearSelection = () => {
    setSelected(isEditMode ? [resolveDocumentType(initialData)] : []);
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selected.length === 0) {
      setError('Select at least one document type');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditMode) {
        const documentType = selected[0];
        const result = await updateComponent(initialData!.id, {
          documentType,
          label: documentTypeLabel(documentType),
        });

        if (result.success && result.component) {
          onSuccess(mapCreated(result.component));
        } else {
          setError(result.error || 'Failed to update document');
        }
        return;
      }

      const result = await createComponents(processId, { documentTypes: selected });

      if (result.success && result.components) {
        onSuccess(result.components.map(mapCreated));
      } else {
        setError(result.error || 'Failed to create documents');
      }
    } catch (err) {
      console.error('Error saving components:', err);
      setError('Failed to save document requirements');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="component-modal-title"
        className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-elevated w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="shrink-0 bg-white border-b border-ash-divider px-4 py-4 sm:p-6 flex items-start gap-3">
          <h2
            id="component-modal-title"
            className="flex-1 min-w-0 text-[22px] sm:text-[31px] leading-tight font-medium text-portrait-ink"
            style={{ fontFamily: 'Basier Circle', letterSpacing: '-0.4px' }}
          >
            {isEditMode ? 'Edit Document' : 'Add Document Requirements'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 hover:bg-slate-helper/10 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-slate-helper" />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex flex-col min-h-0 flex-1 overflow-hidden"
        >
          <div className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6 space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-helper pointer-events-none" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents…"
                className="pl-10"
                autoFocus
                aria-label="Search document types"
              />
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="text-slate-helper">
                {isEditMode
                  ? 'Choose one document type'
                  : `${selected.length} selected`}
              </p>
              {!isEditMode && selected.length > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="shrink-0 text-portrait-ink underline-offset-2 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            {!isEditMode && selected.length > 0 && (
              <div className="flex flex-wrap gap-2 content-start">
                {selected.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleType(value)}
                    className="inline-flex max-w-full items-start gap-1.5 rounded-2xl bg-sky-wash px-3 py-1.5 text-left text-xs font-medium text-portrait-ink hover:bg-mint-wash transition-colors"
                  >
                    <span className="min-w-0 break-words whitespace-normal">
                      {documentTypeLabel(value)}
                    </span>
                    <X className="h-3 w-3 shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
            <div className="border border-ash-divider rounded-2xl divide-y divide-ash-divider">
              {filteredTypes.length === 0 ? (
                <p className="p-4 text-sm text-slate-helper">
                  No documents match “{search.trim()}”.
                </p>
              ) : (
                filteredTypes.map((type) => {
                  const isAlreadyAdded =
                    !isEditMode && alreadyAdded.has(type.value);
                  const isChecked = selected.includes(type.value);

                  return (
                    <div
                      key={type.value}
                      className={`px-3 py-3 sm:px-4 ${isAlreadyAdded ? 'opacity-50' : 'hover:bg-sky-wash/40'}`}
                    >
                      <Checkbox
                        checked={isChecked || isAlreadyAdded}
                        disabled={isAlreadyAdded || isSubmitting}
                        onChange={() => {
                          if (!isAlreadyAdded) toggleType(type.value);
                        }}
                        label={type.label}
                        description={isAlreadyAdded ? 'Already added' : undefined}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {error && (
            <p className="shrink-0 px-4 sm:px-6 text-sm text-red-600">{error}</p>
          )}

          <div className="shrink-0 flex flex-wrap gap-3 px-4 py-4 sm:px-6 sm:pb-6 border-t border-ash-divider bg-white">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting || selected.length === 0}
            >
              {isSubmitting
                ? 'Saving...'
                : isEditMode
                  ? 'Update Document'
                  : selected.length > 1
                    ? `Add ${selected.length} Documents`
                    : 'Add Document'}
            </Button>
            <Button type="button" onClick={onClose} variant="ghost" size="md">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
