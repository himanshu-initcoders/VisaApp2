import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Home, Plane } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { SITE_NAME } from '@/lib/seo/site';

export const metadata: Metadata = {
  title: 'Page not found',
  description: `This page does not exist on ${SITE_NAME}. Head home or browse visa and passport services for Indian citizens.`,
  robots: {
    index: false,
    follow: true,
  },
};

const QUICK_LINKS = [
  { href: '/passport', label: 'Passport services', icon: Plane },
  { href: '/blogs', label: 'Guides & blogs', icon: BookOpen },
] as const;

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#f8f6f1]">
        {/* Atmospheric washes — scrapbook paper, not flat white */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-mint-wash/70 blur-3xl motion-safe:animate-[notfound-drift_14s_ease-in-out_infinite]" />
          <div className="absolute -right-16 top-40 h-80 w-80 rounded-full bg-peach-wash/80 blur-3xl motion-safe:animate-[notfound-drift_18s_ease-in-out_infinite_reverse]" />
          <div className="absolute bottom-24 left-1/3 h-64 w-64 rounded-full bg-sky-wash/80 blur-3xl motion-safe:animate-[notfound-drift_16s_ease-in-out_infinite]" />
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgb(8 48 76 / 0.06) 1px, transparent 0)',
              backgroundSize: '22px 22px',
            }}
          />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 pb-16 pt-28 text-center sm:px-6 lg:px-8">
          {/* Stamp-like mark */}
          <div
            className="mb-5 inline-flex -rotate-3 items-center justify-center rounded-[24px] border border-portrait-ink/15 bg-white/70 px-5 py-2 shadow-[0_8px_24px_rgb(8_48_76_/_0.06)] backdrop-blur-sm motion-safe:animate-[notfound-rise_0.7s_ease-out_both]"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-helper">
              Lost boarding pass
            </p>
          </div>

          <div className="relative motion-safe:animate-[notfound-rise_0.55s_ease-out_both]">
            <p
              aria-hidden
              className="pointer-events-none absolute -right-4 -top-7 font-script text-2xl text-nautical-teal sm:-right-16 sm:-top-5 sm:text-4xl sm:-rotate-[8deg]"
            >
              wrong turn
            </p>
            <h1 className="font-basier text-[clamp(4.75rem,18vw,8rem)] font-medium leading-none tracking-[-0.06em] text-portrait-ink">
              404
            </h1>
            {/* Single rainbow accent — Portrait signature, once */}
            <span
              aria-hidden
              className="mx-auto mt-2 block h-[3px] w-24 rounded-full sm:w-32"
              style={{
                background:
                  'linear-gradient(90deg, rgb(38,192,255), rgb(230,0,194) 20%, rgb(255,73,78) 40%, rgb(255,161,62) 60%, rgb(255,200,55) 80%, rgb(0,204,61))',
              }}
            />
          </div>

          <div className="mt-6 max-w-xl space-y-2 motion-safe:animate-[notfound-rise_0.55s_ease-out_0.06s_both]">
            <h2 className="font-basier text-[1.75rem] leading-tight tracking-[-0.03em] text-portrait-ink sm:text-4xl">
              This page packed its bags
            </h2>
            <p className="text-[15px] leading-7 text-slate-helper sm:text-base sm:leading-7">
              The link may be outdated, or the page never existed. Your visa and
              passport path with {SITE_NAME} is still right here.
            </p>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row motion-safe:animate-[notfound-rise_0.55s_ease-out_0.1s_both]">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-button border-[1.5px] border-portrait-ink bg-transparent px-6 py-3.5 text-base font-medium text-portrait-ink transition-all duration-200 hover:bg-portrait-ink hover:text-white focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:ring-offset-2 active:scale-[0.98]"
            >
              <Home className="h-4 w-4 shrink-0" />
              Back to home
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center justify-center gap-2 rounded-button px-6 py-3.5 text-base font-medium text-portrait-ink transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-portrait-ink focus:ring-offset-2"
            >
              See how it works
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          </div>

          <nav
            aria-label="Helpful links"
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 motion-safe:animate-[notfound-rise_0.55s_ease-out_0.14s_both]"
          >
            {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center gap-2 text-sm font-medium text-nautical-teal transition-colors hover:text-portrait-ink"
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </main>
      <Footer />
    </>
  );
}
