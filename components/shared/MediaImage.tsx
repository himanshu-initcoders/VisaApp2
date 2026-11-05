import Image, { type ImageProps } from 'next/image';
import { isSvgMediaUrl, toAppMediaUrl } from '@/lib/upload/mediaUrl';
import { cn } from '@/lib/utils';

type MediaImageProps = Omit<ImageProps, 'src'> & {
  /** Stored key, /uploads path, S3 URL, or already-proxied /api/media URL */
  src: string | null | undefined;
};

/**
 * next/image wrapper that always rewrites storage URLs through /api/media.
 * Use for any DB/CDN-backed photo so private S3 and extensionless local files work.
 * SVGs fall back to <img> because the Next optimizer returns 400 for them.
 */
export function MediaImage({ src, alt, className, fill, width, height, ...rest }: MediaImageProps) {
  const resolved = toAppMediaUrl(src) || src;
  if (!resolved) return null;

  if (isSvgMediaUrl(resolved) || isSvgMediaUrl(src)) {
    const style =
      fill
        ? undefined
        : {
            width: typeof width === 'number' ? width : undefined,
            height: typeof height === 'number' ? height : undefined,
          };
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolved}
        alt={alt}
        width={typeof width === 'number' ? width : undefined}
        height={typeof height === 'number' ? height : undefined}
        className={cn(fill && 'absolute inset-0 h-full w-full', className)}
        style={style}
      />
    );
  }

  return (
    <Image
      src={resolved}
      alt={alt}
      className={className}
      fill={fill}
      width={width}
      height={height}
      {...rest}
    />
  );
}
