import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MotionReveal } from '@/components/public/MotionReveal';
import { ProcessTimeline } from '@/components/public/ProcessTimeline';

const steps = [
  {
    id: 'traveller-info',
    title: 'Choose your destination',
    description:
      'Pick the country you’re visiting and the visa that fits your trip: tourist, business or study.',
    stepNumber: 1,
  },
  {
    id: 'docs',
    title: 'Check documents and price',
    description:
      'See the full cost, how long it takes, and the exact documents you’ll need, before you pay.',
    stepNumber: 2,
  },
  {
    id: 'review',
    title: 'Apply in one go',
    description:
      'Add travellers, upload your documents and pay. Our experts review everything before it’s submitted.',
    stepNumber: 3,
  },
  {
    id: 'submit',
    title: 'Track your visa',
    description:
      'Get updates at every stage, so you always know where your application stands.',
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
              Your visa in four simple steps
            </h1>
            <p className="text-base leading-8 text-slate-helper">
              Clear guidance for first-time travellers, and no repeated paperwork for frequent ones.
            </p>
          </MotionReveal>

          <ProcessTimeline steps={steps} />
        </div>
      </main>
      <Footer />
    </>
  );
}
