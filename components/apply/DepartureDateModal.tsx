'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';

export type DepartureMode = 'fixed' | 'flexible';

export interface DepartureSelection {
  mode: DepartureMode;
  /** YYYY-MM-DD when mode is fixed */
  departure?: string;
  /** YYYY-MM when mode is flexible */
  month?: string;
}

interface DepartureDateModalProps {
  open: boolean;
  onClose: () => void;
  onProceed: (selection: DepartureSelection) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MONTH_COUNT = 18;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toMonthKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function formatMonthShort(date: Date) {
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/** Monday-first weekday index (0 = Mon … 6 = Sun). */
function mondayIndex(date: Date) {
  return (date.getDay() + 6) % 7;
}

function buildMonthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = mondayIndex(first);
  const cells: Array<{ date: Date; inMonth: boolean } | null> = [];

  for (let i = 0; i < leading; i += 1) {
    const date = new Date(year, month, -leading + i + 1);
    cells.push({ date, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), inMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]?.date;
    const next = last
      ? new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1)
      : new Date(year, month + 1, 1);
    cells.push({ date: next, inMonth: false });
  }

  return cells;
}

export function DepartureDateModal({
  open,
  onClose,
  onProceed,
}: DepartureDateModalProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const months = useMemo(() => {
    return Array.from({ length: MONTH_COUNT }, (_, index) => {
      return new Date(today.getFullYear(), today.getMonth() + index, 1);
    });
  }, [today]);

  const [mode, setMode] = useState<DepartureMode>('fixed');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const canProceed =
    mode === 'fixed' ? Boolean(selectedDate) : Boolean(selectedMonth);

  const handleProceed = () => {
    if (mode === 'fixed' && selectedDate) {
      onProceed({ mode: 'fixed', departure: selectedDate });
      return;
    }
    if (mode === 'flexible' && selectedMonth) {
      onProceed({ mode: 'flexible', month: selectedMonth });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[#08111f]/55 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="departure-date-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-[420px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-elevated sm:max-h-[85vh] sm:rounded-[28px]"
        onClick={(event) => event.stopPropagation()}
      >
            <div className="relative border-b border-ash px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-slate-helper transition-colors hover:bg-mist hover:text-portrait-ink"
          >
            <X className="h-4 w-4" />
          </button>
          <h2
            id="departure-date-title"
            className="pr-8 text-center font-basier text-xl text-portrait-ink sm:text-2xl"
          >
            Select your departure date
          </h2>

          <div className="mt-4 flex rounded-full bg-[#f3f4f6] p-1">
            {(
              [
                { id: 'fixed', label: 'Fixed Dates' },
                { id: 'flexible', label: 'Flexible' },
              ] as const
            ).map((item) => {
              const active = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-all ${
                    active
                      ? 'bg-white text-[#3b82f6] shadow-sm ring-1 ring-[#3b82f6]/30'
                      : 'text-slate-helper hover:text-portrait-ink'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {mode === 'fixed' ? (
            <div className="space-y-6">
              <div className="sticky top-0 z-10 grid grid-cols-7 bg-white pb-2 text-center text-xs font-medium text-slate-helper">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              {months.map((monthDate) => {
                const year = monthDate.getFullYear();
                const month = monthDate.getMonth();
                const cells = buildMonthMatrix(year, month);

                return (
                  <div key={toMonthKey(monthDate)}>
                    <p className="mb-3 text-center text-sm font-semibold text-portrait-ink">
                      {formatMonthYear(monthDate)}
                    </p>
                    <div className="grid grid-cols-7 gap-y-1">
                      {cells.map((cell, index) => {
                        if (!cell) return <span key={index} />;

                        const key = toDateKey(cell.date);
                        const isPast = cell.date < today;
                        const isSelected = selectedDate === key;
                        const disabled = isPast || !cell.inMonth;

                        return (
                          <button
                            key={`${key}-${index}`}
                            type="button"
                            disabled={disabled}
                            onClick={() => setSelectedDate(key)}
                            className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors ${
                              isSelected
                                ? 'bg-[#3b82f6] font-semibold text-white'
                                : disabled
                                  ? 'cursor-not-allowed text-fog line-through'
                                  : 'text-portrait-ink hover:bg-sky-wash'
                            }`}
                          >
                            {cell.date.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {months.map((monthDate) => {
                const key = toMonthKey(monthDate);
                const active = selectedMonth === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedMonth(key)}
                    className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 transition-colors ${
                      active
                        ? 'border-[#3b82f6] bg-sky-wash/60 text-[#3b82f6]'
                        : 'border-ash text-portrait-ink hover:border-fog hover:bg-[#f8fafc]'
                    }`}
                  >
                    <CalendarDays
                      className={`h-5 w-5 ${
                        active ? 'text-[#3b82f6]' : 'text-slate-helper'
                      }`}
                    />
                    <span className="text-sm font-medium">
                      {formatMonthShort(monthDate)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-ash p-4 sm:p-5">
          <button
            type="button"
            disabled={!canProceed}
            onClick={handleProceed}
            className="w-full rounded-[20px] bg-[#ffb800] px-4 py-3.5 text-base font-semibold text-portrait-ink transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Proceed to Application
          </button>
        </div>
      </div>
    </div>
  );
}
