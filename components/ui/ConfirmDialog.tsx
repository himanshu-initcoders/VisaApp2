'use client';

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
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

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

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

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        className={cn(
          'relative w-full max-w-md bg-white rounded-3xl shadow-elevated p-6',
          'transform transition-all duration-200',
          open ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        )}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          disabled={loading}
          className={cn(
            'absolute top-4 right-4 p-1 rounded-lg text-slate-helper hover:text-portrait-ink hover:bg-sky-wash transition-colors',
            loading && 'opacity-50 cursor-not-allowed'
          )}
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <h2
          id="dialog-title"
          className="text-[31px] font-medium leading-tight tracking-tight text-portrait-ink mb-3 pr-8"
          style={{ fontFamily: 'Basier Circle, sans-serif' }}
        >
          {title}
        </h2>

        {/* Message */}
        <p
          id="dialog-description"
          className="text-base text-graphite-body mb-6 leading-relaxed"
        >
          {message}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={loading}
          >
            {cancelText}
          </Button>

          {destructive ? (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className={cn(
                'px-6 py-2.5 rounded-full text-sm font-medium transition-all',
                'bg-red-500 text-white',
                'hover:bg-red-600',
                'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {loading ? 'Processing...' : confirmText}
            </button>
          ) : (
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? 'Processing...' : confirmText}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
