import type { Metadata } from 'next';
import {
  DEFAULT_OG_IMAGE,
  SITE_LOCALE,
  SITE_NAME,
} from '@/lib/seo/site';

type OgImageInput =
  | {
      url: string;
      width?: number;
      height?: number;
      alt?: string;
    }
  | undefined
  | null;

export type BuildPageMetadataInput = {
  /** Short title without brand — root template appends `| Viserv`. */
  title: string;
  description: string;
  path: string;
  keywords?: readonly string[] | string[];
  /** When set, ignores the title template (use for the home page). */
  absoluteTitle?: string;
  ogImage?: OgImageInput;
  ogType?: 'website' | 'article';
  robots?: Metadata['robots'];
  publishedTime?: string;
  modifiedTime?: string;
};

/**
 * Shared public-page metadata: unique title/description, canonical,
 * Open Graph, Twitter, and optional keywords — no duplicated brand suffix.
 */
export function buildPageMetadata(input: BuildPageMetadataInput): Metadata {
  const title = input.absoluteTitle
    ? { absolute: input.absoluteTitle }
    : input.title;

  const resolvedTitle = input.absoluteTitle ?? input.title;
  const ogImage = input.ogImage?.url
    ? {
        url: input.ogImage.url,
        ...(input.ogImage.width ? { width: input.ogImage.width } : {}),
        ...(input.ogImage.height ? { height: input.ogImage.height } : {}),
        alt: input.ogImage.alt || resolvedTitle,
      }
    : { ...DEFAULT_OG_IMAGE };

  return {
    title,
    description: input.description,
    ...(input.keywords && input.keywords.length > 0
      ? { keywords: [...input.keywords] }
      : {}),
    alternates: { canonical: input.path },
    openGraph: {
      title: resolvedTitle,
      description: input.description,
      url: input.path,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type: input.ogType ?? 'website',
      images: [ogImage],
      ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
      ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: resolvedTitle,
      description: input.description,
      images: [ogImage.url],
    },
    ...(input.robots ? { robots: input.robots } : {}),
  };
}

/** Metadata for authenticated / staff surfaces that must stay out of the index. */
export const NOINDEX_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};
