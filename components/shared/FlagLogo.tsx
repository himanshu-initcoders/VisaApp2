import Image from 'next/image';
import { getFlagEmoji } from '@/lib/public';
import { isSvgMediaUrl, toAppMediaUrl } from '@/lib/upload/mediaUrl';
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

  const resolvedFlagUrl = toAppMediaUrl(flagUrl) || flagUrl;
  if (resolvedFlagUrl) {
    // Local static flags + SVGs: use <img> (optimizer can 400 on SVG / miss static webp).
    const usePlainImg =
      isSvgMediaUrl(resolvedFlagUrl) ||
      isSvgMediaUrl(flagUrl) ||
      resolvedFlagUrl.startsWith('/flags/');

    if (usePlainImg) {
      return (
        <span className={cn(box, className)} aria-hidden={!alt}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolvedFlagUrl}
            alt={alt}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </span>
      );
    }
    return (
      <span className={cn(box, className)} aria-hidden={!alt}>
        <Image
          src={resolvedFlagUrl}
          alt={alt}
          fill
          sizes={tokens.sizes}
          className="object-cover"
        />
      </span>
    );
  }

  // Prefer bundled flag assets by ISO2 when no uploaded URL exists.
  if (code.length === 2) {
    const localFlag = `/flags/${code.toLowerCase()}.webp`;
    return (
      <span className={cn(box, className)} aria-hidden={!alt}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={localFlag}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const fallback = e.currentTarget.nextElementSibling;
            if (fallback instanceof HTMLElement) fallback.hidden = false;
          }}
        />
        <span
          hidden
          className={cn(
            'absolute inset-0 inline-flex items-center justify-center leading-none',
            tokens.emoji
          )}
          suppressHydrationWarning
        >
          {getFlagEmoji(code)}
        </span>
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
