'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { FileCheck, GripVertical, Plus, Search, X } from 'lucide-react';
import type { DocumentTypeCatalogItem } from '@/lib/document-types';
import {
  createPassportComponents,
  updatePassportComponent,
  deletePassportComponent,
  reorderPassportComponents,
} from '@/app/(admin)/admin/config/passport-listings/actions';

interface PassportComponentRow {
  id: string;
  passportListingId: string;
  key: string;
  documentType: string | null;
  label: string | null;
  sortOrder: number;
}

interface PassportComponentsManagerProps {
  listingId: string;
  initialComponents: PassportComponentRow[];
  catalog: DocumentTypeCatalogItem[];
}

function SortableDocCard({
  component,
  index,
  onEdit,
  onDelete,
}: {
  component: PassportComponentRow;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: component.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-start gap-4 rounded-3xl border border-ash-divider bg-white p-5"
    >
      <button
        type="button"
        className="mt-1 text-slate-helper"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint-wash text-sm font-medium">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-portrait-ink">
          {component.label || component.documentType || 'Document'}
        </p>
        <p className="text-sm text-slate-helper">{component.documentType}</p>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" variant="ghost" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}

export function PassportComponentsManager({
  listingId,
  initialComponents,
  catalog,
}: PassportComponentsManagerProps) {
  const router = useRouter();
  const [components, setComponents] = useState(initialComponents);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PassportComponentRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [editLabel, setEditLabel] = useState('');
  const [query, setQuery] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);
  useEffect(() => setComponents(initialComponents), [initialComponents]);

  const existing = useMemo(
    () =>
      new Set(
        components.map((c) => c.documentType).filter(Boolean) as string[]
      ),
    [components]
  );

  const filteredCatalog = catalog.filter((item) => {
    if (editing) return item.value === editing.documentType;
    if (existing.has(item.value)) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.value.toLowerCase().includes(q)
    );
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const openCreate = () => {
    setEditing(null);
    setSelected([]);
    setQuery('');
    setShowModal(true);
  };

  const openEdit = (component: PassportComponentRow) => {
    setEditing(component);
    setEditLabel(component.label || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (editing) {
      const result = await updatePassportComponent(editing.id, {
        documentType: editing.documentType || '',
        label: editLabel,
      });
      if (!result.success) {
        alert(result.error || 'Failed to update');
        return;
      }
    } else {
      if (selected.length === 0) {
        alert('Select at least one document type');
        return;
      }
      const result = await createPassportComponents(listingId, {
        documentTypes: selected,
      });
      if (!result.success) {
        alert(result.error || 'Failed to create');
        return;
      }
    }
    setShowModal(false);
    setEditing(null);
    router.refresh();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = components.findIndex((c) => c.id === active.id);
    const newIndex = components.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(components, oldIndex, newIndex);
    setComponents(reordered);
    await reorderPassportComponents(
      listingId,
      reordered.map((c) => c.id)
    );
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const result = await deletePassportComponent(deletingId);
    if (result.success) {
      setDeletingId(null);
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete');
    }
  };

  const toggleSelected = (value: string) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-helper">
          {components.length} document{components.length !== 1 ? 's' : ''} from
          the shared catalog
        </p>
        <Button type="button" variant="primary" onClick={openCreate}>
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4 shrink-0" />
            Add document
          </span>
        </Button>
      </div>

      {components.length === 0 ? (
        <EmptyState
          icon={<FileCheck className="h-12 w-12" />}
          title="No documents configured"
          description="Pick document types applicants must upload for this passport product."
          action={{ label: 'Add document', onClick: openCreate }}
        />
      ) : isMounted ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={components.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {components.map((component, index) => (
                <SortableDocCard
                  key={component.id}
                  component={component}
                  index={index}
                  onEdit={() => openEdit(component)}
                  onDelete={() => setDeletingId(component.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="space-y-3">
          {components.map((component, index) => (
            <SortableDocCard
              key={component.id}
              component={component}
              index={index}
              onEdit={() => openEdit(component)}
              onDelete={() => setDeletingId(component.id)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowModal(false)}
          />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-elevated">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-medium text-portrait-ink">
                {editing ? 'Edit document' : 'Add documents'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {editing ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-helper">
                  Type: {editing.documentType}
                </p>
                <label className="block text-sm font-medium text-portrait-ink">
                  Label
                  <input
                    className="mt-1.5 w-full rounded-2xl border border-ash-divider px-4 py-3 text-sm"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-helper" />
                  <input
                    className="w-full rounded-2xl border border-ash-divider py-3 pl-10 pr-4 text-sm"
                    placeholder="Search document types"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {filteredCatalog.map((item) => (
                    <label
                      key={item.value}
                      className="flex items-center gap-3 rounded-2xl border border-ash-divider px-3 py-2"
                    >
                      <Checkbox
                        checked={selected.includes(item.value)}
                        onChange={() => toggleSelected(item.value)}
                      />
                      <span className="text-sm text-portrait-ink">
                        {item.label}
                      </span>
                    </label>
                  ))}
                  {filteredCatalog.length === 0 && (
                    <p className="py-6 text-center text-sm text-slate-helper">
                      No document types left to add.
                    </p>
                  )}
                </div>
              </div>
            )}

            <Button
              type="button"
              variant="primary"
              className="mt-6 w-full"
              onClick={handleSave}
            >
              Save
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete document requirement"
        message="Applicants will no longer be asked for this document."
        confirmText="Delete"
        destructive
      />
    </>
  );
}
