'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface ModalFrameProps {
  children: ReactNode;
  /** Called when the dimmed backdrop (outside the panel) is clicked. */
  onClose?: () => void;
  /** Extra classes on the white panel (e.g. max-w-md). Default max-w-2xl. */
  panelClassName?: string;
  /** Extra classes on the scrollable overlay shell. */
  className?: string;
}

/**
 * Shared admin dialog shell: portals to document.body so overlays sit above
 * the sidebar/header, with top padding so the panel never hugs the viewport edge.
 */
export function ModalFrame({
  children,
  onClose,
  panelClassName,
  className,
}: ModalFrameProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      role="presentation"
      className={cn(
        'fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto',
        'bg-black/40 p-4 pt-12 sm:p-8 sm:pt-20',
        className
      )}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative my-auto w-full max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-3xl bg-white shadow-elevated sm:max-h-[calc(100dvh-10rem)]',
          panelClassName ?? 'max-w-2xl'
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
