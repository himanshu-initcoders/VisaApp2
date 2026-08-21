import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MotionReveal } from '@/components/public/MotionReveal';
import { ProcessTimeline } from '@/components/public/ProcessTimeline';

const steps = [
  {
    id: 'traveller-info',
    title: 'Choose a destination',
    description:
      'Start from a country page that already explains the entry type, price context, and travel timeline.',
    stepNumber: 1,
  },
  {
    id: 'docs',
    title: 'Check your documents',
    description:
      'See the required documents before you upload anything, with quick explanations built into each requirement card.',
    stepNumber: 2,
  },
  {
    id: 'review',
    title: 'Review price and ETA',
    description:
      'Understand what is government-related, what is service-related, and how long the process should take.',
    stepNumber: 3,
  },
  {
    id: 'submit',
    title: 'Start confidently',
    description:
      'Move into the application flow with fewer surprises because the marketing page already answered the big questions.',
    stepNumber: 4,
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8f6f1] px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-14">
          <MotionReveal className="max-w-3xl space-y-4">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-helper">
              How it works
            </p>
            <h1 className="font-basier text-5xl leading-tight text-portrait-ink">
              A calmer visa experience starts before the form.
            </h1>
            <p className="text-base leading-8 text-slate-helper">
              The public experience is designed to answer the first questions
              quickly: what this product is, what it costs, what documents it
              needs, and what happens next.
            </p>
          </MotionReveal>

          <ProcessTimeline steps={steps} />
        </div>
      </main>
      <Footer />
    </>
  );
}
