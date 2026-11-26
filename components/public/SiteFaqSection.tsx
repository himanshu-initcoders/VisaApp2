'use client';

import { FaqAccordion } from '@/components/public/FaqAccordion';
import { MotionReveal } from '@/components/public/MotionReveal';
import { SITE_FAQS } from '@/lib/seo/siteFaqs';

interface SiteFaqSectionProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  className?: string;
}

/** Shared FAQ block for home and how-it-works (Portrait accordion). */
export function SiteFaqSection({
  eyebrow = 'FAQs',
  title = 'Common questions, answered.',
  description = 'Short answers about who Viserv helps, pricing, documents, and how we differ from government portals.',
  className,
}: SiteFaqSectionProps) {
  const faqs = SITE_FAQS.map((faq) => ({
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
  }));

  return (
    <section
      id="faqs"
      className={
        className ??
        'mx-auto max-w-7xl scroll-mt-32 px-4 py-10 sm:scroll-mt-36 sm:px-6 sm:py-14 lg:px-8'
      }
    >
      <MotionReveal className="mb-6 max-w-2xl space-y-2 sm:mb-8 sm:space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-helper sm:text-xs sm:tracking-[0.24em]">
          {eyebrow}
        </p>
        <h2 className="font-basier text-2xl leading-tight tracking-[-0.03em] text-portrait-ink sm:text-4xl">
          {title}
        </h2>
        <p className="text-sm leading-6 text-slate-helper sm:text-base sm:leading-7">
          {description}
        </p>
      </MotionReveal>
      <FaqAccordion faqs={faqs} />
    </section>
  );
}
