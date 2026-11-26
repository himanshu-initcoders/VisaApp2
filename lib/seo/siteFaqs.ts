/**
 * Sitewide FAQs for home and /how-it-works (AEO answer blocks + FAQPage schema).
 */

import { SITE_NAME } from '@/lib/seo/site';

export const SITE_FAQS = [
  {
    id: 'who-viserv-serves',
    question: `Who is ${SITE_NAME} for?`,
    answer:
      'Viserv helps Indian citizens apply for visas to other countries and manage Indian passport services (fresh, re-issue, and related assistance) with clear pricing and guided document checks.',
  },
  {
    id: 'visa-vs-passport',
    question: 'Do you handle visas and passports?',
    answer:
      'Yes. Use destination visa listings for travel abroad, and the passport hub for Indian passport fresh or re-issue assistance. Each product shows documents, fees, and timelines before you pay.',
  },
  {
    id: 'pricing-transparency',
    question: 'Are fees shown before I pay?',
    answer:
      'Yes. Each visa listing and passport product separates government fees, service fees, and GST where they apply, so you see the total before checkout.',
  },
  {
    id: 'documents-before-pay',
    question: 'Can I see required documents before applying?',
    answer:
      'Yes. Open a country or visa listing to review the document checklist, processing time, and price packages before you start an application.',
  },
  {
    id: 'not-government',
    question: 'Is Viserv a government portal or Passport Seva?',
    answer:
      'No. Viserv is a private assistance service. It is not an embassy, consulate, or Passport Seva. You can always apply yourself on the official government portal if you prefer.',
  },
] as const;

export type SiteFaq = (typeof SITE_FAQS)[number];
