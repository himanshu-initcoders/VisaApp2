'use client';

import { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

interface UnderlineFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  trailing?: React.ReactNode;
  min?: string;
  max?: string;
  error?: string | null;
}

/** ISO YYYY-MM-DD → DD/MM/YYYY for consistent display across browsers. */
export function isoToDisplay(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function isValidIsoDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(`${iso}T00:00:00`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
    date.getDate() === day
  );
}

/** Accepts DD/MM/YYYY (or ISO) and returns YYYY-MM-DD when valid. */
export function displayToIso(display: string): string {
  const trimmed = display.trim();
  if (!trimmed) return '';
  if (isValidIsoDate(trimmed)) return trimmed;

  const dmy = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3];
    const iso = `${year}-${month}-${day}`;
    return isValidIsoDate(iso) ? iso : trimmed;
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return trimmed;
  const date = new Date(parsed);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function maskDdMmYyyy(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function toIsoValue(value: string) {
  if (!value) return '';
  if (isValidIsoDate(value)) return value;
  const converted = displayToIso(value);
  return isValidIsoDate(converted) ? converted : '';
}

export function UnderlineField({
  label,
  value,
  onChange,
  required,
  type = 'text',
  trailing,
  min,
  max,
  error,
}: UnderlineFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDate = type === 'date';
  const isoValue = isDate ? toIsoValue(value) : value;
  const [displayValue, setDisplayValue] = useState(() =>
    isDate && isoValue ? isoToDisplay(isoValue) : value
  );

  useEffect(() => {
    if (!isDate) {
      setDisplayValue(value);
      return;
    }
    setDisplayValue(isoValue ? isoToDisplay(isoValue) : '');
  }, [isDate, isoValue, value]);

  const dismissPicker = (picker: HTMLInputElement) => {
    // Safari/macOS keeps the native date popover open after a value is chosen
    // (and showPicker without focus also blocks click-away dismiss). Blur closes it.
    picker.blur();
    inputRef.current?.focus({ preventScroll: true });
  };

  const commitDisplay = (nextDisplay: string) => {
    const digits = nextDisplay.replace(/\D/g, '');
    if (!digits) {
      onChange('');
      return;
    }
    if (digits.length < 8) return;
    const iso = displayToIso(nextDisplay);
    if (isValidIsoDate(iso)) onChange(iso);
  };

  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
        {label}
        {required && <span className="text-[#ff4940]"> *</span>}
      </span>
      <div
        className={[
          'relative mt-1 flex items-end gap-2 border-b pb-2',
          error ? 'border-[#ff4940]' : 'border-ash',
        ].join(' ')}
      >
        {trailing}
        {isDate ? (
          <>
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/YYYY"
              value={displayValue}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => {
                const next = maskDdMmYyyy(event.target.value);
                setDisplayValue(next);
                commitDisplay(next);
              }}
              onBlur={() => {
                if (!displayValue.trim()) {
                  onChange('');
                  setDisplayValue('');
                  return;
                }
                const iso = displayToIso(displayValue);
                if (isValidIsoDate(iso)) {
                  onChange(iso);
                  setDisplayValue(isoToDisplay(iso));
                  return;
                }
                // Revert incomplete/invalid typing to the last committed ISO value.
                setDisplayValue(isoValue ? isoToDisplay(isoValue) : '');
              }}
              className="w-full bg-transparent text-base text-portrait-ink outline-none placeholder:text-slate-helper/60"
            />
            <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center pb-0.5 text-slate-helper hover:text-portrait-ink">
              <Calendar className="pointer-events-none h-4 w-4" aria-hidden />
              <input
                type="date"
                lang="en-GB"
                value={isoValue}
                min={min}
                max={max}
                aria-label={`Pick ${label}`}
                onChange={(event) => {
                  const next = event.target.value;
                  onChange(next);
                  setDisplayValue(next ? isoToDisplay(next) : '');
                  const picker = event.currentTarget;
                  // Close after paint so Safari applies the value first.
                  requestAnimationFrame(() => dismissPicker(picker));
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </span>
          </>
        ) : (
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
            className="w-full bg-transparent text-base text-portrait-ink outline-none"
          />
        )}
      </div>
      {error ? (
        <p className="mt-1 text-xs text-[#ff4940]" role="alert">
          {error}
        </p>
      ) : null}
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
