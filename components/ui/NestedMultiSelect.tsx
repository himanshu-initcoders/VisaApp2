'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type NestedMultiSelectChild = {
  id: string;
  label: string;
};

export type NestedMultiSelectItem = {
  id: string;
  label: string;
  children?: NestedMultiSelectChild[];
};

export type NestedMultiSelectValue = {
  parents: string[];
  children: string[];
};

export interface NestedMultiSelectProps {
  label?: string;
  items: NestedMultiSelectItem[];
  value: NestedMultiSelectValue;
  onChange: (value: NestedMultiSelectValue) => void;
  placeholder?: string;
  className?: string;
}

function childIds(item: NestedMultiSelectItem): string[] {
  return (item.children ?? []).map((child) => child.id);
}

export function toggleNestedParent(
  item: NestedMultiSelectItem,
  value: NestedMultiSelectValue
): NestedMultiSelectValue {
  const ids = childIds(item);
  const parents = value.parents.filter((id) => id !== item.id);
  const children = value.children.filter((id) => !ids.includes(id));
  if (value.parents.includes(item.id)) {
    return { parents, children };
  }
  return { parents: [...parents, item.id], children };
}

export function toggleNestedChild(
  item: NestedMultiSelectItem,
  childId: string,
  value: NestedMultiSelectValue
): NestedMultiSelectValue {
  const ids = childIds(item);
  const parentSelected = value.parents.includes(item.id);
  const selected = new Set(parentSelected ? ids : ids.filter((id) => value.children.includes(id)));
  if (selected.has(childId)) selected.delete(childId);
  else selected.add(childId);

  const parents = value.parents.filter((id) => id !== item.id);
  const children = value.children.filter((id) => !ids.includes(id));
  if (ids.length > 0 && selected.size === ids.length) {
    return { parents: [...parents, item.id], children };
  }
  return { parents, children: [...children, ...ids.filter((id) => selected.has(id))] };
}

export function nestedSelectionSummary(
  items: NestedMultiSelectItem[],
  value: NestedMultiSelectValue,
  placeholder: string
): string {
  const labels: string[] = [];

  for (const item of items) {
    if (value.parents.includes(item.id)) {
      labels.push(item.label);
      continue;
    }
    const selectedKids = (item.children ?? []).filter((child) => value.children.includes(child.id));
    if (selectedKids.length === 1) {
      labels.push(selectedKids[0].label);
    } else if (selectedKids.length > 1) {
      labels.push(`${item.label} (${selectedKids.length})`);
    }
  }

  if (labels.length === 0) return placeholder;
  if (labels.length === 1) return labels[0];
  return `${labels[0]} + ${labels.length - 1}`;
}

function Checkbox({
  checked,
  indeterminate,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  return (
    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 accent-portrait-ink"
      />
      <span className="truncate font-switzer text-sm text-portrait-ink">{label}</span>
    </label>
  );
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 7.5 10 12.5 15 7.5" />
    </svg>
  );
}

/**
 * Nested multi-select. A checked parent means every child. Partial child
 * checks leave the parent unchecked (indeterminate) and store child ids.
 */
export function NestedMultiSelect({
  label,
  items,
  value,
  onChange,
  placeholder = 'Select…',
  className,
}: NestedMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const summary = nestedSelectionSummary(items, value, placeholder);
  const hasSelection = summary !== placeholder;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative w-full', className)}>
      {label && (
        <span className="mb-2 block font-switzer text-sm font-medium text-portrait-ink">{label}</span>
      )}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-[16px] border border-ash bg-white px-4 py-2.5 text-left',
          'font-switzer text-base transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-portrait-ink',
          hasSelection ? 'text-portrait-ink' : 'text-slate-helper'
        )}
      >
        <span className="truncate">{summary}</span>
        <Chevron expanded={open} />
      </button>

      {open && (
        <div
          id={listId}
          role="dialog"
          aria-label={label || placeholder}
          className="absolute z-30 mt-2 max-h-[min(28rem,70vh)] w-max min-w-full max-w-[22rem] overflow-auto rounded-[16px] border border-ash bg-white p-2 shadow-sm"
        >
          {items.length === 0 ? (
            <p className="px-2 py-2 font-switzer text-sm text-slate-helper">No options</p>
          ) : (
            items.map((item) => {
              const ids = childIds(item);
              const showChildren = ids.length > 1;
              const expanded = expandedIds.includes(item.id);
              const parentChecked = value.parents.includes(item.id);
              const selectedChildCount = ids.filter((id) => value.children.includes(id)).length;
              const indeterminate = !parentChecked && selectedChildCount > 0 && selectedChildCount < ids.length;

              return (
                <div key={item.id}>
                  <div className="flex items-center gap-1 rounded-[12px] px-2 py-1.5 hover:bg-sky-wash">
                    <Checkbox
                      checked={parentChecked}
                      indeterminate={indeterminate}
                      label={item.label}
                      onChange={() => onChange(toggleNestedParent(item, value))}
                    />
                    {showChildren && (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? 'Hide' : 'Show'} ${item.label} visas`}
                        onClick={() =>
                          setExpandedIds((current) =>
                            current.includes(item.id)
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id]
                          )
                        }
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-portrait-ink hover:bg-white"
                      >
                        <Chevron expanded={expanded} />
                      </button>
                    )}
                  </div>
                  {showChildren && expanded && (
                    <div className="mb-1 ml-6 border-l border-ash pl-2">
                      {item.children!.map((child) => (
                        <div key={child.id} className="rounded-[12px] px-2 py-1.5 hover:bg-sky-wash">
                          <Checkbox
                            checked={parentChecked || value.children.includes(child.id)}
                            label={child.label}
                            onChange={() => onChange(toggleNestedChild(item, child.id, value))}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
