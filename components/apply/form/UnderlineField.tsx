'use client';

import { useRef } from 'react';
import { Calendar } from 'lucide-react';

interface UnderlineFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  trailing?: React.ReactNode;
}

export function isoToDisplay(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function displayToIso(display: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(display)) return display;
  const parsed = Date.parse(display);
  if (Number.isNaN(parsed)) return display;
  const date = new Date(parsed);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function UnderlineField({
  label,
  value,
  onChange,
  required,
  type = 'text',
  trailing,
}: UnderlineFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDate = type === 'date';

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        // Some browsers only allow showPicker from a direct user gesture on the input.
      }
    }
    input.focus();
    input.click();
  };

  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
        {label}
        {required && <span className="text-[#ff4940]"> *</span>}
      </span>
      <div className="relative mt-1 flex items-end gap-2 border-b border-ash pb-2">
        {trailing}
        <input
          ref={inputRef}
          type={type}
          value={value}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
          onInput={(event) =>
            onChange((event.target as HTMLInputElement).value)
          }
          className={[
            'w-full bg-transparent text-base text-portrait-ink outline-none',
            isDate
              ? 'scheme-light [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
        {isDate && (
          <button
            type="button"
            aria-label={`Pick ${label}`}
            onClick={openPicker}
            className="shrink-0 pb-0.5 text-slate-helper hover:text-portrait-ink"
          >
            <Calendar className="h-4 w-4" />
          </button>
        )}
      </div>
    </label>
  );
}

export function UnderlineSelect({
  label,
  value,
  onChange,
  required,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
        {label}
        {required && <span className="text-[#ff4940]"> *</span>}
      </span>
      <div className="relative mt-1 border-b border-ash pb-2">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none bg-transparent text-base text-portrait-ink outline-none"
        >
          {children}
        </select>
      </div>
    </label>
  );
}
