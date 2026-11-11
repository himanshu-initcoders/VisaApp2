'use client';

import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface DropdownProps {
  /** Panel content. Receives `close` for item handlers. */
  children: ReactNode | ((api: { close: () => void }) => ReactNode);
  /** Trigger button content. Receives open state for chevrons, etc. */
  trigger: ReactNode | ((api: { open: boolean }) => ReactNode);
  /** Controlled open state. Omit for uncontrolled. */
  open?: boolean;
  /** Called when open state should change. */
  onOpenChange?: (open: boolean) => void;
  /** Default open for uncontrolled usage. */
  defaultOpen?: boolean;
  align?: 'left' | 'right';
  /** Extra classes on the root wrapper. */
  className?: string;
  /** Extra classes on the trigger button. */
  triggerClassName?: string;
  /** Extra classes on the panel. */
  panelClassName?: string;
  /** Accessible name for the trigger when it has no visible text. */
  'aria-label'?: string;
  disabled?: boolean;
}

/**
 * Lightweight Portrait dropdown: click trigger → panel, Esc / outside click closes.
 */
export function Dropdown({
  children,
  trigger,
  open: openProp,
  onOpenChange,
  defaultOpen = false,
  align = 'right',
  className,
  triggerClassName,
  panelClassName,
  'aria-label': ariaLabel,
  disabled = false,
}: DropdownProps) {
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = isControlled ? Boolean(openProp) : uncontrolledOpen;
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChangeRef.current?.(next);
  };

  const close = () => setOpen(false);
  const toggle = () => setOpen(!open);

  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        if (!isControlled) setUncontrolledOpen(false);
        onOpenChangeRef.current?.(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!isControlled) setUncontrolledOpen(false);
        onOpenChangeRef.current?.(false);
      }
    };

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, isControlled]);

  return (
    <div ref={rootRef} className={cn('relative inline-block', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? panelId : undefined}
        aria-label={ariaLabel}
        onClick={toggle}
        className={cn(
          'inline-flex items-center gap-2 rounded-[28px] transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-portrait-ink focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          triggerClassName
        )}
      >
        {typeof trigger === 'function' ? trigger({ open }) : trigger}
      </button>

      {open && (
        <div
          id={panelId}
          role="menu"
          className={cn(
            'absolute top-full z-[70] mt-2 min-w-[14rem] overflow-hidden rounded-[24px] border border-ash bg-white p-2 shadow-elevated',
            align === 'right' ? 'right-0' : 'left-0',
            panelClassName
          )}
        >
          {typeof children === 'function' ? children({ close }) : children}
        </div>
      )}
    </div>
  );
}

export interface DropdownItemProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

/** Menu row styled as a Portrait action item (use for buttons). */
export function DropdownItem({
  children,
  className,
  ...props
}: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'inline-flex w-full items-center gap-2 rounded-[16px] px-3 py-2.5 text-left text-sm font-medium text-portrait-ink transition-colors hover:bg-sky-wash/40',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface DropdownLinkItemProps {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

/** Menu row styled as a Portrait action item (use for navigation links). */
export function DropdownLinkItem({
  href,
  children,
  className,
  onClick,
}: DropdownLinkItemProps) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className={cn(
        'inline-flex w-full items-center gap-2 rounded-[16px] px-3 py-2.5 text-sm font-medium text-portrait-ink transition-colors hover:bg-sky-wash/40',
        className
      )}
    >
      {children}
    </Link>
  );
}

export function DropdownSeparator({ className }: { className?: string }) {
  return <div className={cn('my-1 border-t border-ash', className)} />;
}

export function DropdownHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('border-b border-ash px-3 py-2', className)}>
      {children}
    </div>
  );
}
