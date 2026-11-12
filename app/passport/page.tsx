import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowUpRight,
  BadgeIndianRupee,
  BookOpenText,
  FileCheck2,
  FileText,
  HelpCircle,
  IdCard,
  ShieldCheck,
  Timer,
  UserRound,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { FaqAccordion } from '@/components/public/FaqAccordion';
import { MotionReveal } from '@/components/public/MotionReveal';
import { PassportHeroPricingCard } from '@/components/public/PassportHeroPricingCard';
import { ProcessTimeline } from '@/components/public/ProcessTimeline';
import { StickySectionNav } from '@/components/public/StickySectionNav';
import { PassportHubViewTracker } from '@/components/analytics/PassportHubViewTracker';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildPassportServiceJsonLd,
  buildWebPageJsonLd,
} from '@/lib/seo/jsonld';

const PASSPORT_TITLE = 'Indian passport services — Viserv';
const PASSPORT_DESCRIPTION =
  'Fresh passport or re-issue for Indian citizens — clear documents, government fees, Tatkaal options, and expert-guided applications with Viserv.';
const PASSPORT_OG_IMAGE = {
  url: '/indian-passport-banner.jpg',
  alt: 'Indian passport cover on a desk',
};

export const metadata: Metadata = {
  title: PASSPORT_TITLE,
  description: PASSPORT_DESCRIPTION,
  alternates: { canonical: '/passport' },
  openGraph: {
    title: PASSPORT_TITLE,
    description: PASSPORT_DESCRIPTION,
    url: '/passport',
    type: 'website',
    images: [PASSPORT_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: PASSPORT_TITLE,
    description: PASSPORT_DESCRIPTION,
    images: [PASSPORT_OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
  },
};

const sectionItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'timelines', label: 'Timelines' },
  { id: 'documents', label: 'Documents' },
  { id: 'process', label: 'Process' },
  { id: 'fees', label: 'Fees' },
  { id: 'purposes', label: 'Use cases' },
  { id: 'faqs', label: 'FAQs' },
];

const passportTypes = [
  {
    title: 'Fresh passport',
    description:
      'For first-time applicants who have never held an Indian passport.',
    note: 'Choose this when you are applying for your very first booklet.',
    icon: IdCard,
  },
  {
    title: 'Re-issue',
    description:
      'For expiry, near-expiry, exhausted pages, change in particulars, lost, or damaged passport cases.',
    note: 'This is the route most renewals and profile changes fall under.',
    icon: FileText,
  },
  {
    title: 'Normal scheme',
    description:
      'Standard processing route. Police verification may be pre-issue, post-issue, or not required depending on the case.',
    note: 'Best when you do not need urgent dispatch.',
    icon: ShieldCheck,
  },
  {
    title: 'Tatkaal scheme',
    description:
      'Urgent processing option with an additional government fee and post-police verification in all such cases.',
    note: 'Use when time matters and your case is eligible for Tatkaal.',
    icon: Timer,
  },
];

const timelineCards = [
  {
    title: 'Fresh passport',
    value: 'Up to 30 working days',
    description:
      'Citizen Charter timeline for fresh issue, excluding the police verification period.',
  },
  {
    title: 'Re-issue',
    value: 'Up to 7 or 30 working days',
    description:
      'Up to 7 working days when pre-police verification is not required, and up to 30 when it is required.',
  },
  {
    title: 'Tatkaal',
    value: 'Up to 3 working days',
    description:
      'Subject to Tatkaal eligibility. The Citizen Charter also notes an additional Tatkaal charge.',
  },
];

const documentGroups = [
  {
    title: 'Fresh passport essentials',
    bullets: [
      'Proof of present address',
      'Proof of date of birth',
      'Any category-specific documents shown by the Passport Seva Document Advisor',
      'Originals plus one set of self-attested photocopies at the PSK or POPSK',
    ],
  },
  {
    title: 'Re-issue essentials',
    bullets: [
      'Existing passport details are mandatory',
      'Supporting proof for the reason for re-issue such as expiry, exhaustion of pages, address change, or change in personal particulars',
      'Extra paperwork may be needed for lost, damaged, or major name-change cases',
      'Bring originals and self-attested photocopies of all supporting documents',
    ],
  },
  {
    title: 'Minor applications',
    bullets: [
      'Parent address proof can be used for present address proof',
      'Carry parents’ passports if available',
      'Consent assumptions and supporting declarations can change by family situation',
      'For minors below 15, passport validity is limited to 5 years or until age 18, whichever is earlier',
    ],
  },
  {
    title: 'Tatkaal guidance',
    bullets: [
      'No separate proof of urgency is required',
      'Post-police verification is done in all Tatkaal cases',
      'Adults typically need a stronger supporting document set than a basic normal application',
      'Always confirm your exact eligibility and document list in the official Document Advisor before paying',
    ],
  },
];

const processSteps = [
  {
    id: 'register',
    title: 'Register or sign in',
    description:
      'Create your Passport Seva account, choose whether you need a fresh passport or a re-issue, and decide between Normal and Tatkaal.',
    stepNumber: 1,
  },
  {
    id: 'fill',
    title: 'Complete the application',
    description:
      'Fill the online form carefully, matching your name, date of birth, address, and other personal details to your supporting records.',
    stepNumber: 2,
  },
  {
    id: 'pay',
    title: 'Pay and book appointment',
    description:
      'Pay the government fee online, then book your Passport Seva Kendra or POPSK appointment slot.',
    stepNumber: 3,
  },
  {
    id: 'visit',
    title: 'Visit the PSK or POPSK',
    description:
      'Carry originals and self-attested photocopies. Biometric capture, document checks, and case review happen at the appointment.',
    stepNumber: 4,
  },
  {
    id: 'verify',
    title: 'Police verification if applicable',
    description:
      'Depending on the case, police verification can be pre-issue, post-issue, or skipped. Tatkaal cases follow post-police verification.',
    stepNumber: 5,
  },
  {
    id: 'track',
    title: 'Track dispatch',
    description:
      'Use the Passport Seva portal and SMS/email updates to follow status until the passport is printed and dispatched.',
    stepNumber: 6,
  },
];

const feeCards = [
  {
    title: 'Adult 36-page booklet',
    amount: 'Starts at Rs 1,500',
    note: 'Common base fee for an ordinary 36-page passport booklet.',
  },
  {
    title: 'Adult 60-page booklet',
    amount: 'Starts at Rs 2,000',
    note: 'Useful for frequent travelers who need more visa pages.',
  },
  {
    title: 'Tatkaal surcharge',
    amount: '+ Rs 2,000',
    note: 'Citizen Charter states an additional Rs 2,000 is levied for Tatkaal.',
  },
  {
    title: 'Fresh application discount',
    amount: '10% fee discount',
    note: 'Official fee calculator notes this for minors up to age 8 and senior citizens above 60 on fresh applications.',
  },
];

const purposes = [
  {
    title: 'First passport',
    description:
      'For students, professionals, or families applying for the first time.',
  },
  {
    title: 'Renew or re-issue',
    description:
      'When the current booklet is expiring, expired, full, damaged, or no longer matches your details.',
  },
  {
    title: 'Urgent travel',
    description:
      'Tatkaal can be the right fit when travel is close and your case is eligible.',
  },
  {
    title: 'Minor passport',
    description:
      'Useful for school trips, family travel, OCI processing, and early identity readiness.',
  },
  {
    title: 'Address or name update',
    description:
      'Covers marriage-related updates, relocation, and other personal-particular changes.',
  },
  {
    title: 'Frequent travel',
    description:
      'A 60-page booklet helps travelers who regularly collect visas or immigration stamps.',
  },
];

const faqs = [
  {
    id: 'fresh-vs-reissue',
    question: 'When should I choose fresh passport instead of re-issue?',
    answer:
      'Choose a fresh passport if you have never held an Indian passport before. Re-issue is used for expiry, near-expiry, exhausted pages, lost or damaged passport cases, or changes in personal particulars.',
  },
  {
    id: 'tatkaal-urgency-proof',
    question: 'Do I need proof of urgency for a Tatkaal passport?',
    answer:
      'No. The official instruction booklet states that no separate proof of urgency is required for Tatkaal. However, you must still meet the applicable eligibility and document conditions.',
  },
  {
    id: 'tatkaal-police',
    question: 'Does Tatkaal avoid police verification completely?',
    answer:
      'No. The official guidance says post-police verification is done in all Tatkaal cases. Tatkaal speeds up dispatch, but it does not remove verification from the overall lifecycle.',
  },
  {
    id: 'minor-validity',
    question: 'How long is a minor passport valid?',
    answer:
      'For minors below 15 years, validity is generally 5 years or until the child turns 18, whichever is earlier. Minors between 15 and 18 can apply either for a 10-year validity passport or one valid until age 18.',
  },
  {
    id: 'photograph',
    question: 'Do I need to carry a photo to the PSK?',
    answer:
      'For applications submitted at Passport Seva Kendras and Post Office Passport Seva Kendras, the instruction booklet states that a photograph is not required. Other collection center workflows may differ.',
  },
  {
    id: 'documents',
    question: 'What documents should I definitely carry to the appointment?',
    answer:
      'Carry the originals and one set of self-attested photocopies of every document relevant to your case. The exact checklist varies by age, scheme, and reason for application, so the final source of truth is the official Document Advisor on Passport Seva.',
  },
  {
    id: 'fees',
    question: 'Are the fees the same for every passport case?',
    answer:
      'No. Fees vary by age, fresh versus re-issue, 36-page versus 60-page booklet, validity for minors, and whether you choose Tatkaal. Use the official Passport Seva Fee Calculator to confirm the exact government fee before payment.',
  },
];

export default async function PassportPage() {
  const { getActivePassportListingsWithPublicData } = await import(
    '@/lib/db/queries/passport-config'
  );
  const listings = await getActivePassportListingsWithPublicData();

  const heroListings = listings.map((listing) => ({
    id: listing.id,
    serviceType: listing.serviceType as 'fresh' | 'reissue',
    name: listing.name,
    prices: listing.prices.map((price) => ({
      id: price.id,
      scheme: price.scheme,
      bookletPages: price.bookletPages,
      governmentFeeAmount: parseFloat(price.governmentFeeAmount || '0'),
      serviceFeeAmount: parseFloat(price.serviceFeeAmount || '0'),
      governmentGstFeeAmount: parseFloat(price.governmentGstFeeAmount || '0'),
    })),
  }));

  const startingValue = heroListings
    .flatMap((listing) =>
      listing.prices.map(
        (price) =>
          price.governmentFeeAmount +
          price.serviceFeeAmount +
          price.governmentGstFeeAmount
      )
    )
    .filter((amount) => Number.isFinite(amount) && amount > 0)
    .sort((a, b) => a - b)[0];

  const dbDocumentGroups = listings
    .filter((listing) => listing.componentsRequired.length > 0)
    .map((listing) => ({
      title:
        listing.serviceType === 'fresh'
          ? 'Fresh passport essentials'
          : 'Re-issue essentials',
      bullets: listing.componentsRequired.map(
        (doc) => doc.label || doc.documentType || 'Document'
      ),
    }));

  const resolvedDocumentGroups =
    dbDocumentGroups.length > 0
      ? [...dbDocumentGroups, ...documentGroups.slice(2)]
      : documentGroups;

  const dbFaqs = listings.flatMap((listing) =>
    listing.faqs.map((faq) => ({
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
    }))
  );
  const resolvedFaqs = dbFaqs.length > 0 ? dbFaqs : faqs;

  const faqSchema = buildFaqPageJsonLd(
    resolvedFaqs.map((faq) => ({
      question: faq.question,
      answer: faq.answer,
    }))
  );

  const fallbackServices = [
    { serviceType: 'fresh', name: 'Fresh Indian passport' },
    { serviceType: 'reissue', name: 'Indian passport re-issue' },
  ] as const;

  const serviceSchemas = (
    listings.length > 0
      ? listings.map((listing) => {
          const firstPrice = listing.prices[0];
          const total = firstPrice
            ? parseFloat(String(firstPrice.governmentFeeAmount || '0')) +
              parseFloat(String(firstPrice.serviceFeeAmount || '0')) +
              parseFloat(String(firstPrice.governmentGstFeeAmount || '0'))
            : undefined;
          return {
            serviceType: listing.serviceType,
            name: listing.name,
            price:
              typeof total === 'number' && Number.isFinite(total) && total > 0
                ? total
                : undefined,
          };
        })
      : fallbackServices.map((item) => ({ ...item, price: undefined }))
  ).map((listing) =>
    buildPassportServiceJsonLd({
      name: listing.name,
      description: PASSPORT_DESCRIPTION,
      path: '/passport',
      serviceType: listing.serviceType,
      price: listing.price,
    })
  );

  const jsonLd = [
    buildWebPageJsonLd({
      title: PASSPORT_TITLE,
      description: PASSPORT_DESCRIPTION,
      path: '/passport',
    }),
    buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Passport', path: '/passport' },
    ]),
    ...serviceSchemas,
  ];
  if (faqSchema) {
    jsonLd.push(faqSchema);
  }

  return (
    <>
      <JsonLd data={jsonLd} />
      <PassportHubViewTracker
        listingCount={listings.length}
        startingValue={startingValue}
      />
      <Header />
      <main className="min-h-screen bg-[#f8f6f1] pb-20 pt-28 sm:pt-32">
        <section className="px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <MotionReveal className="overflow-hidden rounded-[32px] border border-ash-divider bg-white shadow-card sm:rounded-[40px]">
              <div className="relative min-h-[420px] sm:min-h-[480px] lg:min-h-[540px]">
                <Image
                  src="/indian-passport-banner.jpg"
                  alt="Indian passport cover on a desk"
                  fill
                  priority
                  className="object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220]/55 via-[#0b1220]/15 to-[#0b1220]/10" />
                <div className="relative z-10 flex items-center justify-center px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
                  <PassportHeroPricingCard listings={heroListings} />
                </div>
              </div>
            </MotionReveal>
          </div>
        </section>

        <div className="mt-8">
          <StickySectionNav items={sectionItems} />
        </div>

        <section id="overview" className="px-4 pt-10 sm:px-6 sm:pt-14 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <MotionReveal className="max-w-2xl space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-helper sm:text-sm">
                Overview
              </p>
              <h2 className="font-basier text-3xl text-portrait-ink sm:text-4xl">
                Start by choosing the right passport path.
              </h2>
              <p className="text-[15px] leading-7 text-slate-helper sm:text-base">
                Most confusion comes from picking the wrong application type or
                scheme. This cheat sheet keeps the first decision simple.
              </p>
            </MotionReveal>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {passportTypes.map((item, index) => {
                const Icon = item.icon;

                return (
                  <MotionReveal key={item.title} delayMs={index * 60}>
                    <div className="h-full rounded-[28px] border border-ash-divider bg-white p-5 shadow-card">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4f8ff] text-portrait-ink">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-5 text-lg font-semibold text-portrait-ink">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-slate-helper">
                        {item.description}
                      </p>
                      <p className="mt-4 rounded-[18px] bg-[#f8fafc] px-4 py-3 text-sm text-portrait-ink">
                        {item.note}
                      </p>
                    </div>
                  </MotionReveal>
                );
              })}
            </div>
          </div>
        </section>

        <section id="timelines" className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <MotionReveal className="max-w-2xl space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-helper sm:text-sm">
                Timelines
              </p>
              <h2 className="font-basier text-3xl text-portrait-ink sm:text-4xl">
                The official time windows to keep in mind.
              </h2>
              <p className="text-[15px] leading-7 text-slate-helper sm:text-base">
                These are public Citizen Charter signals, not promises for every
                edge case. Verification complexity can extend real-world timing.
              </p>
            </MotionReveal>

            <div className="grid gap-4 md:grid-cols-3">
              {timelineCards.map((item, index) => (
                <MotionReveal key={item.title} delayMs={index * 60}>
                  <div className="h-full rounded-[28px] border border-ash-divider bg-white p-5 shadow-card">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-portrait-ink text-white">
                      <Timer className="h-5 w-5" />
                    </div>
                    <p className="mt-5 text-sm uppercase tracking-[0.18em] text-slate-helper">
                      {item.title}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-portrait-ink">
                      {item.value}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-helper">
                      {item.description}
                    </p>
                  </div>
                </MotionReveal>
              ))}
            </div>
          </div>
        </section>

        <section id="documents" className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <MotionReveal className="max-w-3xl space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-helper sm:text-sm">
                Required documents
              </p>
              <h2 className="font-basier text-3xl text-portrait-ink sm:text-4xl">
                Think in document groups, not one giant checklist.
              </h2>
              <p className="text-[15px] leading-7 text-slate-helper sm:text-base">
                The official Document Advisor changes the exact list based on
                age, scheme, and reason for application. These groups help you
                prepare the right bucket of documents before you begin.
              </p>
            </MotionReveal>

            <div className="grid gap-4 lg:grid-cols-2">
              {resolvedDocumentGroups.map((group, index) => (
                <MotionReveal key={group.title} delayMs={index * 60}>
                  <div className="h-full rounded-[28px] border border-ash-divider bg-white p-5 shadow-card sm:p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-wash text-portrait-ink">
                        <FileCheck2 className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-semibold text-portrait-ink">
                        {group.title}
                      </h3>
                    </div>
                    <ul className="mt-5 space-y-3">
                      {group.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="flex gap-3 text-sm leading-7 text-slate-helper"
                        >
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-portrait-ink" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </MotionReveal>
              ))}
            </div>

            <MotionReveal>
              <div className="rounded-[28px] border border-dashed border-ash-divider bg-white px-5 py-5 text-sm leading-7 text-slate-helper shadow-card sm:px-6">
                Best practice: open the official Passport Seva Document Advisor
                immediately before payment, because the exact checklist can
                change based on your category and jurisdiction.
              </div>
            </MotionReveal>
          </div>
        </section>

        <section id="process" className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <MotionReveal className="max-w-2xl space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-helper sm:text-sm">
                Process
              </p>
              <h2 className="font-basier text-3xl text-portrait-ink sm:text-4xl">
                The passport journey, step by step.
              </h2>
              <p className="text-[15px] leading-7 text-slate-helper sm:text-base">
                This is the simplest mental model for how a normal public Indian
                passport application moves from account creation to dispatch.
              </p>
            </MotionReveal>

            <ProcessTimeline steps={processSteps} />
          </div>
        </section>

        <section id="fees" className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <MotionReveal className="max-w-3xl space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-helper sm:text-sm">
                Government fees
              </p>
              <h2 className="font-basier text-3xl text-portrait-ink sm:text-4xl">
                Useful fee anchors before you calculate your exact amount.
              </h2>
              <p className="text-[15px] leading-7 text-slate-helper sm:text-base">
                These figures are meant to orient the applicant, not replace the
                official calculator. Exact fees vary by age bracket, booklet
                size, reason for re-issue, validity, and Tatkaal choice.
              </p>
            </MotionReveal>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {feeCards.map((item, index) => (
                <MotionReveal key={item.title} delayMs={index * 60}>
                  <div className="h-full rounded-[28px] border border-ash-divider bg-white p-5 shadow-card">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-peach-wash text-portrait-ink">
                      <BadgeIndianRupee className="h-5 w-5" />
                    </div>
                    <p className="mt-5 text-sm uppercase tracking-[0.18em] text-slate-helper">
                      {item.title}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-portrait-ink">
                      {item.amount}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-helper">
                      {item.note}
                    </p>
                  </div>
                </MotionReveal>
              ))}
            </div>

            <MotionReveal>
              <div className="rounded-[28px] bg-[#0b1220] px-5 py-6 text-white shadow-elevated sm:px-6">
                <p className="text-sm uppercase tracking-[0.18em] text-white/60">
                  Important fee note
                </p>
                <p className="mt-2 text-[15px] leading-7 text-white/85 sm:text-base">
                  The most reliable source of truth is the official Passport
                  Seva fee calculator. Use it whenever your case involves a
                  minor, a re-issue reason, or a special validity choice.
                </p>
              </div>
            </MotionReveal>
          </div>
        </section>

        <section id="purposes" className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <MotionReveal className="max-w-2xl space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-helper sm:text-sm">
                Different purposes
              </p>
              <h2 className="font-basier text-3xl text-portrait-ink sm:text-4xl">
                Why people usually need an Indian passport page like this.
              </h2>
              <p className="text-[15px] leading-7 text-slate-helper sm:text-base">
                Applicants often come with a reason first, not a category first.
                This section helps map real life situations to the likely
                passport path.
              </p>
            </MotionReveal>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {purposes.map((item, index) => (
                <MotionReveal key={item.title} delayMs={index * 50}>
                  <div className="h-full rounded-[28px] border border-ash-divider bg-white p-5 shadow-card">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint-wash text-portrait-ink">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-portrait-ink">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-slate-helper">
                      {item.description}
                    </p>
                  </div>
                </MotionReveal>
              ))}
            </div>
          </div>
        </section>

        <section id="faqs" className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <MotionReveal className="max-w-2xl space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-helper sm:text-sm">
                FAQs
              </p>
              <h2 className="font-basier text-3xl text-portrait-ink sm:text-4xl">
                Common questions before the first appointment.
              </h2>
              <p className="text-[15px] leading-7 text-slate-helper sm:text-base">
                These answers are written to reduce the usual confusion, while
                still nudging the user back to the official tools for case
                specific validation.
              </p>
            </MotionReveal>

            <FaqAccordion faqs={resolvedFaqs} />
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
