import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export const BRAND_NAME = 'Viserv';

const SIZE_MAP = {
  sm: { height: 28, width: 112 },
  md: { height: 36, width: 144 },
  lg: { height: 44, width: 176 },
} as const;

export interface LogoProps {
  /** Link target. Pass `null` to render without a link. Defaults to `/`. */
  href?: string | null;
  size?: keyof typeof SIZE_MAP;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  /** Optional subtitle under the mark (e.g. Admin Panel). */
  subtitle?: string;
  /** Fires when the linked logo is activated (e.g. close mobile menus). */
  onNavigate?: () => void;
}

/**
 * Viserv brand mark — uses `/logo.png` (icon + wordmark).
 */
export function Logo({
  href = '/',
  size = 'md',
  className,
  imageClassName,
  priority = false,
  subtitle,
  onNavigate,
}: LogoProps) {
  const { height, width } = SIZE_MAP[size];

  const mark = (
    <span className={cn('inline-flex flex-col items-start gap-0.5', className)}>
      <Image
        src="/logo.png"
        alt={BRAND_NAME}
        width={width}
        height={height}
        priority={priority}
        className={cn('h-auto w-auto object-contain', imageClassName)}
        style={{ height, width: 'auto' }}
      />
      {subtitle ? (
        <span className="font-switzer text-xs text-slate-helper">{subtitle}</span>
      ) : null}
    </span>
  );

  if (href === null) {
    return mark;
  }

  return (
    <Link
      href={href}
      aria-label={BRAND_NAME}
      onClick={onNavigate}
      className="inline-flex shrink-0 transition-opacity hover:opacity-90"
    >
      {mark}
    </Link>
  );
}
