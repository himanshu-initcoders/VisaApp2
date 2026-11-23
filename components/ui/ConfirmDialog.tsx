'use client';

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { ModalFrame } from './ModalFrame';
import { X } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  loading?: boolean;
}

/**
 * ConfirmDialog Component - Portrait Design System
 *
 * A reusable confirmation modal following Portrait design patterns.
 * - Backdrop: Black with 40% opacity
 * - Modal: White canvas, 24px border radius, shadow-elevated
 * - Max width: 600px
 * - Padding: 24px
 * - Header: Basier Circle 31px
 * - Buttons: Cancel (ghost), Confirm (rainbow or red if destructive)
 *
 * @example
 * <ConfirmDialog
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onConfirm={handleDelete}
 *   title="Delete Country?"
 *   message="This will permanently delete Thailand. This action cannot be undone."
 *   destructive
 * />
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  loading = false
}: ConfirmDialogProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !loading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, loading, onClose]);

  if (!open) return null;

  const handleConfirm = () => {
    if (!loading) {
      onConfirm();
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <ModalFrame
      onClose={loading ? undefined : handleClose}
      panelClassName="max-w-md p-6"
    >
      <button
        type="button"
        onClick={handleClose}
        disabled={loading}
        className={cn(
          'absolute top-4 right-4 rounded-lg p-1 text-slate-helper transition-colors hover:bg-sky-wash hover:text-portrait-ink',
          loading && 'cursor-not-allowed opacity-50'
        )}
        aria-label="Close dialog"
      >
        <X className="h-5 w-5" />
      </button>

      <h2
        id="dialog-title"
        className="mb-3 pr-8 text-[31px] font-medium leading-tight tracking-tight text-portrait-ink"
        style={{ fontFamily: 'Basier Circle, sans-serif' }}
      >
        {title}
      </h2>

      <p
        id="dialog-description"
        className="mb-6 text-base leading-relaxed text-graphite-body"
      >
        {message}
      </p>

      <div className="flex items-center justify-end gap-3">
        <Button variant="ghost" onClick={handleClose} disabled={loading}>
          {cancelText}
        </Button>

        {destructive ? (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              'rounded-full px-6 py-2.5 text-sm font-medium transition-all',
              'bg-red-500 text-white',
              'hover:bg-red-600',
              'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        ) : (
          <Button variant="primary" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Processing...' : confirmText}
          </Button>
        )}
      </div>
    </ModalFrame>
  );
}
