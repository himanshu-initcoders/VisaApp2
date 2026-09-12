'use client';

import { useEffect } from 'react';

export type DepartureMode = 'fixed' | 'flexible';

export interface DepartureSelection {
  mode: DepartureMode;
  departure?: string;
  month?: string;
}

interface DepartureDateModalProps {
  open: boolean;
  onClose: () => void;
  onProceed: (selection: DepartureSelection) => void;
}

export function DepartureDateModal({
  open,
  onProceed,
}: DepartureDateModalProps) {
  useEffect(() => {
    if (!open) return;
    onProceed({ mode: 'flexible' });
  }, [open, onProceed]);

  return null;
}
