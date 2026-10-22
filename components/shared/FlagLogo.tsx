import Image from 'next/image';
import { getFlagEmoji } from '@/lib/public';
import { cn } from '@/lib/utils';

export type FlagLogoSize = 'sm' | 'md' | 'lg';
export type FlagLogoShape = 'circle' | 'rect';

const SIZE: Record<
  FlagLogoSize,
  { circle: string; rect: string; emoji: string; sizes: string }
> = {
  sm: {
    circle: 'h-5 w-5',
    rect: 'h-3.5 w-5',
    emoji: 'text-sm',
    sizes: '20px',
  },
  md: {
    circle: 'h-6 w-6',
    rect: 'h-5 w-7',
    emoji: 'text-base',
    sizes: '24px',
  },
  lg: {
    circle: 'h-8 w-8',
    rect: 'h-6 w-9',
    emoji: 'text-xl',
    sizes: '32px',
  },
};

export interface FlagLogoProps {
  /** ISO 3166-1 alpha-2 country code (e.g. US, AE). */
  countryCode?: string | null;
  /** Uploaded / CDN flag image URL from countries.images.flag.url */
  flagUrl?: string | null;
  /** Accessible label; decorative when omitted. */
  alt?: string;
  size?: FlagLogoSize;
  /** Circle for list rows; rect for admin table country columns. */
  shape?: FlagLogoShape;
  className?: string;
}

/**
 * Country flag image with emoji fallback.
 * Use anywhere a visa destination needs a compact national mark.
 */
export function FlagLogo({
  countryCode,
  flagUrl,
  alt = '',
  size = 'md',
  shape = 'circle',
  className,
}: FlagLogoProps) {
  const code = (countryCode || '').trim().toUpperCase();
  const tokens = SIZE[size];
  const box =
    shape === 'circle'
      ? cn(
          'relative shrink-0 overflow-hidden rounded-full bg-sky-wash',
          tokens.circle
        )
      : cn(
          'relative shrink-0 overflow-hidden rounded-sm bg-sky-wash',
          tokens.rect
        );

  if (flagUrl) {
    return (
      <span className={cn(box, className)} aria-hidden={!alt}>
        <Image
          src={flagUrl}
          alt={alt}
          fill
          sizes={tokens.sizes}
          className="object-cover"
        />
      </span>
    );
  }

  if (code.length === 2) {
    return (
      <span
        className={cn(
          box,
          'inline-flex items-center justify-center leading-none',
          tokens.emoji,
          className
        )}
        aria-hidden={!alt}
        title={alt || undefined}
      >
        <span suppressHydrationWarning>{getFlagEmoji(code)}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(box, className)}
      aria-hidden={!alt}
      title={alt || undefined}
    />
  );
}
