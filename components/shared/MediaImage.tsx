import Image, { type ImageProps } from 'next/image';
import { toAppMediaUrl } from '@/lib/upload/mediaUrl';

type MediaImageProps = Omit<ImageProps, 'src'> & {
  /** Stored key, /uploads path, S3 URL, or already-proxied /api/media URL */
  src: string | null | undefined;
};

/**
 * next/image wrapper that always rewrites storage URLs through /api/media.
 * Use for any DB/CDN-backed photo so private S3 and extensionless local files work.
 */
export function MediaImage({ src, alt, ...rest }: MediaImageProps) {
  const resolved = toAppMediaUrl(src) || src;
  if (!resolved) return null;
  return <Image src={resolved} alt={alt} {...rest} />;
}
