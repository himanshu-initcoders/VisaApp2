import { CONTACT_EMAIL, CONTACT_PHONE } from '@/lib/contact';
import {
  DEFAULT_OG_IMAGE,
  SAME_AS,
  SITE_DESCRIPTION,
  SITE_NAME,
} from '@/lib/seo/site';

const DEFAULT_SITE_NAME = SITE_NAME;
const DEFAULT_DESCRIPTION = SITE_DESCRIPTION;

/** Loose JSON-LD document for composing page graphs. */
export type JsonLdDocument = Record<string, unknown>;

export function getSiteUrl(): string {
  // Prefer public origin; fall back to Auth.js URL, then production domain.
  // Never default to viserv.com — live site is www.viserv.in.
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    'https://www.viserv.in';
  return raw.replace(/\/$/, '');
}

export function absoluteUrl(pathOrUrl: string, siteUrl = getSiteUrl()): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${siteUrl}${path}`;
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function buildOrganizationJsonLd(siteUrl = getSiteUrl()): JsonLdDocument {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: DEFAULT_SITE_NAME,
    url: siteUrl,
    logo: absoluteUrl('/apple-touch-icon.png', siteUrl),
    image: absoluteUrl(DEFAULT_OG_IMAGE.url, siteUrl),
    description: DEFAULT_DESCRIPTION,
    email: CONTACT_EMAIL,
    telephone: CONTACT_PHONE,
    sameAs: SAME_AS,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'No 5/1, 1st Cross, RRMR Extn, KH Road',
      addressLocality: 'Bengaluru',
      addressRegion: 'Karnataka',
      postalCode: '560027',
      addressCountry: 'IN',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: CONTACT_PHONE,
        email: CONTACT_EMAIL,
        contactType: 'customer service',
        areaServed: 'IN',
        availableLanguage: ['English', 'Hindi'],
      },
    ],
    areaServed: {
      '@type': 'Country',
      name: 'India',
    },
  };
}

export function buildWebSiteJsonLd(siteUrl = getSiteUrl()): JsonLdDocument {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    name: DEFAULT_SITE_NAME,
    url: siteUrl,
    description: DEFAULT_DESCRIPTION,
    publisher: { '@id': `${siteUrl}/#organization` },
    inLanguage: 'en-IN',
  };
}

export function buildWebPageJsonLd(input: {
  title: string;
  description: string;
  path: string;
  siteUrl?: string;
}): JsonLdDocument {
  const siteUrl = input.siteUrl ?? getSiteUrl();
  const url = absoluteUrl(input.path, siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: input.title,
    description: input.description,
    isPartOf: { '@id': `${siteUrl}/#website` },
    about: { '@id': `${siteUrl}/#organization` },
    inLanguage: 'en-IN',
  };
}

export function buildBreadcrumbJsonLd(
  items: BreadcrumbItem[],
  siteUrl = getSiteUrl()
): JsonLdDocument {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path, siteUrl),
    })),
  };
}

/** Strip HTML/markdown noise so FAQ answers stay quotable in AI excerpts. */
export function stripToPlainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[*_~`#>]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildFaqPageJsonLd(
  faqs: Array<{ question: string; answer: string }>,
  siteUrl = getSiteUrl()
): JsonLdDocument | null {
  if (faqs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: stripToPlainText(faq.question),
      acceptedAnswer: {
        '@type': 'Answer',
        text: stripToPlainText(faq.answer),
      },
    })),
    isPartOf: { '@id': `${siteUrl}/#website` },
  };
}

export function buildHowToJsonLd(input: {
  name: string;
  description: string;
  path: string;
  steps: Array<{ title: string; description: string; stepNumber?: number }>;
  siteUrl?: string;
}): JsonLdDocument {
  const siteUrl = input.siteUrl ?? getSiteUrl();
  const url = absoluteUrl(input.path, siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': `${url}#howto`,
    name: input.name,
    description: input.description,
    url,
    inLanguage: 'en-IN',
    step: input.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: step.stepNumber ?? index + 1,
      name: step.title,
      text: step.description,
      url: `${url}#step-${step.stepNumber ?? index + 1}`,
    })),
  };
}

export function buildItemListJsonLd(input: {
  name: string;
  description: string;
  path: string;
  items: Array<{ name: string; path: string }>;
  siteUrl?: string;
}): JsonLdDocument {
  const siteUrl = input.siteUrl ?? getSiteUrl();
  const url = absoluteUrl(input.path, siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#collection`,
    name: input.name,
    description: input.description,
    url,
    isPartOf: { '@id': `${siteUrl}/#website` },
    inLanguage: 'en-IN',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: input.items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: absoluteUrl(item.path, siteUrl),
      })),
    },
  };
}

export function buildVisaServiceJsonLd(input: {
  name: string;
  description: string;
  path: string;
  countryName: string;
  countryCode: string;
  price?: number;
  currency?: string;
  additionalProperties?: Array<{ name: string; value: string }>;
  siteUrl?: string;
}): JsonLdDocument {
  const siteUrl = input.siteUrl ?? getSiteUrl();
  const url = absoluteUrl(input.path, siteUrl);
  const offer =
    typeof input.price === 'number'
      ? {
          '@type': 'Offer',
          priceCurrency: input.currency || 'INR',
          price: input.price,
          availability: 'https://schema.org/InStock',
          url,
        }
      : undefined;

  const additionalProperty =
    input.additionalProperties && input.additionalProperties.length > 0
      ? input.additionalProperties.map((prop) => ({
          '@type': 'PropertyValue',
          name: prop.name,
          value: prop.value,
        }))
      : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${url}#service`,
    name: input.name,
    description: input.description,
    url,
    provider: { '@id': `${siteUrl}/#organization` },
    areaServed: {
      '@type': 'Country',
      name: input.countryName,
      identifier: input.countryCode,
    },
    audience: {
      '@type': 'Audience',
      geographicArea: {
        '@type': 'Country',
        name: 'India',
      },
    },
    ...(offer ? { offers: offer } : {}),
    ...(additionalProperty ? { additionalProperty } : {}),
  };
}

/** Indian passport fresh / re-issue service for the public passport hub. */
export function buildPassportServiceJsonLd(input: {
  name: string;
  description: string;
  path?: string;
  serviceType?: string;
  price?: number;
  currency?: string;
  siteUrl?: string;
}): JsonLdDocument {
  const siteUrl = input.siteUrl ?? getSiteUrl();
  const path = input.path ?? '/passport';
  const url = absoluteUrl(path, siteUrl);
  const idSuffix = input.serviceType
    ? `#passport-service-${input.serviceType}`
    : '#passport-service';
  const offer =
    typeof input.price === 'number'
      ? {
          '@type': 'Offer',
          priceCurrency: input.currency || 'INR',
          price: input.price,
          availability: 'https://schema.org/InStock',
          url,
        }
      : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${url}${idSuffix}`,
    name: input.name,
    description: input.description,
    url,
    serviceType: input.serviceType
      ? input.serviceType === 'fresh'
        ? 'Fresh passport'
        : input.serviceType === 'reissue'
          ? 'Passport re-issue'
          : input.serviceType === 'fresh_infant'
            ? 'Fresh passport (Infant)'
            : input.serviceType === 'reissue_infant'
              ? 'Passport re-issue (Infant)'
              : input.serviceType
      : 'Passport',
    provider: { '@id': `${siteUrl}/#organization` },
    areaServed: {
      '@type': 'Country',
      name: 'India',
    },
    audience: {
      '@type': 'Audience',
      geographicArea: {
        '@type': 'Country',
        name: 'India',
      },
    },
    ...(offer ? { offers: offer } : {}),
  };
}

export function buildBlogPostingJsonLd(input: {
  title: string;
  description: string;
  path: string;
  datePublished?: string | Date | null;
  dateModified?: string | Date | null;
  imageUrl?: string | null;
  authorName?: string | null;
  siteUrl?: string;
}): JsonLdDocument {
  const siteUrl = input.siteUrl ?? getSiteUrl();
  const url = absoluteUrl(input.path, siteUrl);
  const toIso = (value?: string | Date | null) => {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#blogposting`,
    headline: input.title,
    description: input.description,
    url,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
    },
    author: {
      '@type': 'Person',
      name: input.authorName || DEFAULT_SITE_NAME,
    },
    publisher: { '@id': `${siteUrl}/#organization` },
    ...(input.imageUrl
      ? { image: [absoluteUrl(input.imageUrl, siteUrl)] }
      : {}),
    ...(toIso(input.datePublished)
      ? { datePublished: toIso(input.datePublished) }
      : {}),
    ...(toIso(input.dateModified)
      ? { dateModified: toIso(input.dateModified) }
      : {}),
    inLanguage: 'en-IN',
    isPartOf: { '@id': `${siteUrl}/#website` },
  };
}

/** Organization + WebSite graph for global SEO. */
export function buildSiteGraphJsonLd(siteUrl = getSiteUrl()): JsonLdDocument {
  return {
    '@context': 'https://schema.org',
    '@graph': [buildOrganizationJsonLd(siteUrl), buildWebSiteJsonLd(siteUrl)],
  };
}
