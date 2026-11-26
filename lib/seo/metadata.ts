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

const PRIVATE_ROBOTS: Metadata['robots'] = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
};

/**
 * Private / auth / apply surfaces: clear title+description so Google and
 * link previews never inherit the homepage marketing snippet, plus hard noindex.
 *
 * Pass a short title without the brand — we set an absolute `Title | Viserv`
 * so the browser tab, OG, and Twitter all match (root title.template does not
 * apply to openGraph/twitter).
 */
export function buildPrivateMetadata(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const brandedTitle = input.title.includes(`| ${SITE_NAME}`)
    ? input.title.trim()
    : `${input.title.trim()} | ${SITE_NAME}`;

  return {
    title: { absolute: brandedTitle },
    description: input.description,
    robots: PRIVATE_ROBOTS,
    // No canonical — these URLs must not consolidate into the homepage.
    openGraph: {
      title: brandedTitle,
      description: input.description,
      url: input.path,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      type: 'website',
      images: [{ ...DEFAULT_OG_IMAGE }],
    },
    twitter: {
      card: 'summary',
      title: brandedTitle,
      description: input.description,
      images: [DEFAULT_OG_IMAGE.url],
    },
  };
}

/** Fallback for layouts that wrap many private child routes. */
export const NOINDEX_METADATA: Metadata = buildPrivateMetadata({
  title: 'Private area',
  description:
    'This Viserv page is for signed-in users and is not indexed by search engines.',
  path: '/signin',
});
