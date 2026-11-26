import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MotionReveal } from '@/components/public/MotionReveal';
import { ProcessTimeline } from '@/components/public/ProcessTimeline';
import { SiteFaqSection } from '@/components/public/SiteFaqSection';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildHowToJsonLd,
  buildWebPageJsonLd,
} from '@/lib/seo/jsonld';
import { HOW_IT_WORKS_STEPS } from '@/lib/seo/howItWorksSteps';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SEO_PAGES } from '@/lib/seo/pages';
import { SITE_FAQS } from '@/lib/seo/siteFaqs';
import { SITE_NAME } from '@/lib/seo/site';

const PAGE = SEO_PAGES.howItWorks;

export const metadata: Metadata = buildPageMetadata({
  title: PAGE.title,
  description: PAGE.description,
  path: PAGE.path,
  keywords: PAGE.keywords,
});

export default function HowItWorksPage() {
  const faqSchema = buildFaqPageJsonLd(
    SITE_FAQS.map((faq) => ({
      question: faq.question,
      answer: faq.answer,
    }))
  );

  return (
    <>
      <JsonLd
        data={[
          buildWebPageJsonLd({
            title: `${PAGE.title} | ${SITE_NAME}`,
            description: PAGE.description,
            path: PAGE.path,
          }),
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'How it works', path: PAGE.path },
          ]),
          buildHowToJsonLd({
            name: 'Apply for a visa with Viserv in four steps',
            description: PAGE.description,
            path: PAGE.path,
            steps: HOW_IT_WORKS_STEPS.map((step) => ({
              title: step.title,
              description: step.description,
              stepNumber: step.stepNumber,
            })),
          }),
          ...(faqSchema ? [faqSchema] : []),
        ]}
      />
      <Header />
      <main className="min-h-screen bg-[#f8f6f1] px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-14">
          <MotionReveal className="max-w-3xl space-y-4">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-helper">
              How it works
            </p>
            <h1 className="font-basier text-5xl leading-tight text-portrait-ink">
              Your visa in four simple steps
            </h1>
            <p className="text-base leading-8 text-slate-helper">
              Clear guidance for first-time travellers, and no repeated paperwork for frequent ones.
            </p>
          </MotionReveal>

          <ProcessTimeline steps={[...HOW_IT_WORKS_STEPS]} />

          <SiteFaqSection className="scroll-mt-32 px-0 py-0 sm:scroll-mt-36" />
        </div>
      </main>
      <Footer />
    </>
  );
}
