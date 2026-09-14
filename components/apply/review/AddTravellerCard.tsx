'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

interface AddTravellerCardProps {
  disabled?: boolean;
  onAdd: (name: string) => void;
}

export function AddTravellerCard({ disabled, onAdd }: AddTravellerCardProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const commit = () => {
    const next = name.trim();
    if (!next) return;
    onAdd(next);
    setName('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-medium text-[#3b82f6] transition-colors hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
        Add traveller
      </button>
    );
  }

  return (
    <div className="px-1 pb-1 pt-2">
      <input
        value={name}
        autoFocus
        placeholder="Full name"
        onChange={(event) =>
          setName(event.target.value.replace(/[^a-zA-Z\s]/g, ''))
        }
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') {
            setOpen(false);
            setName('');
          }
        }}
        className="w-full rounded-full border border-ash bg-white px-3 py-2 text-sm text-portrait-ink outline-none placeholder:text-fog focus:border-[#3b82f6]"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setName('');
          }}
          className="flex-1 rounded-full px-2 py-1.5 text-xs text-slate-helper hover:bg-white"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={commit}
          className="flex-1 rounded-full bg-[#3b82f6] px-2 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}
