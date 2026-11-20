/**
 * Unique copy for each indexable public route.
 * Titles omit the brand — root layout uses `title.template: "%s | Viserv"`.
 * Home uses `absolute` so it is not double-branded.
 */

import { SITE_DESCRIPTION, SITE_TITLE } from '@/lib/seo/site';

export const SEO_PAGES = {
  home: {
    path: '/',
    /** Full title; passed as `absolute` so the template does not append the brand twice. */
    titleAbsolute: SITE_TITLE,
    description: SITE_DESCRIPTION,
    keywords: [
      'Viserv',
      'visa for Indians',
      'passport services India',
      'apply visa online India',
      'tourist visa',
      'business visa',
    ],
  },
  howItWorks: {
    path: '/how-it-works',
    title: 'How Viserv visa applications work',
    description:
      'Apply for a visa in four steps: pick your destination, check documents and price, submit once, and track every stage with Viserv.',
    keywords: [
      'how to apply for visa India',
      'visa application steps',
      'Viserv how it works',
      'document checklist visa',
    ],
  },
  passport: {
    path: '/passport',
    title: 'Indian passport services — fresh, re-issue & Tatkaal',
    description:
      'Private passport assistance for Indian citizens — fresh or re-issue, clear documents, Tatkaal options, and guided applications. Not Passport Seva; apply yourself on the official portal if you prefer.',
    keywords: [
      'Indian passport',
      'passport renewal India',
      'fresh passport',
      'Tatkaal passport',
      'passport re-issue',
      'passport documents India',
    ],
    ogImage: {
      url: '/indian-passport-banner.jpg',
      alt: 'Indian passport cover on a desk',
    },
  },
  blogs: {
    path: '/blogs',
    title: 'Visa & passport guides',
    description:
      'Practical guides for Indian travellers: visa tips, passport renewals, documents, and destination checklists from Viserv.',
    keywords: [
      'visa guides India',
      'passport tips',
      'travel documents India',
      'Viserv blog',
    ],
  },
  privacy: {
    path: '/privacy',
    title: 'Privacy Policy',
    description:
      'How Viserv collects, uses, shares, and protects personal data under the Digital Personal Data Protection Act, 2023.',
    keywords: ['Viserv privacy policy', 'DPDP Act', 'data protection'],
  },
  terms: {
    path: '/terms',
    title: 'Terms and Conditions',
    description:
      'Terms and Conditions for using Viserv visa and passport assistance on viserv.in and related channels.',
    keywords: ['Viserv terms', 'visa assistance terms'],
  },
  refund: {
    path: '/refund',
    title: 'Refund Policy',
    description:
      'When and how Viserv refunds Government Fees, Service Fees, and Third-Party Charges for visa and passport orders.',
    keywords: ['Viserv refund policy', 'visa fee refund'],
  },
} as const;
