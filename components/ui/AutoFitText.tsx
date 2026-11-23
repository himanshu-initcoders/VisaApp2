'use client';

import {
  useLayoutEffect,
  useRef,
  type ElementType,
  type HTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

interface AutoFitTextProps extends HTMLAttributes<HTMLElement> {
  children: string;
  /** Starting (max) font size in px. */
  maxPx: number;
  /** Floor font size in px. */
  minPx?: number;
  as?: ElementType;
}

/**
 * Single-line text that shrinks its font size until the full string fits
 * the container width (no ellipsis).
 */
export function AutoFitText({
  children,
  className,
  maxPx,
  minPx = 8,
  as: Tag = 'p',
  style,
  ...rest
}: AutoFitTextProps) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      let size = maxPx;
      el.style.fontSize = `${size}px`;

      while (size > minPx && el.scrollWidth > el.clientWidth + 0.5) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };

    fit();

    const ro = new ResizeObserver(fit);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);

    return () => ro.disconnect();
  }, [children, maxPx, minPx]);

  return (
    <Tag
      ref={ref}
      className={cn(
        'block w-full overflow-hidden whitespace-nowrap',
        className
      )}
      style={{ fontSize: maxPx, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
