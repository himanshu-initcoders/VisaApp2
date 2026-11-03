const DEFAULT_SITE_NAME = 'Viserv';
const DEFAULT_DESCRIPTION =
  'Visa and passport services for Indian citizens — clear pricing, guided applications, and expert review.';

/** Loose JSON-LD document for composing page graphs. */
export type JsonLdDocument = Record<string, unknown>;

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://viserv.com';
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
    description: DEFAULT_DESCRIPTION,
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
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
    isPartOf: { '@id': `${siteUrl}/#website` },
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
