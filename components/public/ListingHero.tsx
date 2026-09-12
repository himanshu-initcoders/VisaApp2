import Image from 'next/image';
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Receipt,
  ShieldCheck,
} from 'lucide-react';
import { HeroWave } from '@/components/public/HeroWave';
import { formatVisaKindLabel } from '@/lib/public';

const TRUST_ITEMS = [
  {
    title: 'Secure Application',
    subtitle: 'Your data is protected',
    Icon: ShieldCheck,
  },
  {
    title: 'Transparent Fees',
    subtitle: 'No hidden charges',
    Icon: Receipt,
  },
  {
    title: 'Real-time Updates',
    subtitle: 'Track your application',
    Icon: Clock,
  },
] as const;

const SCRIPT_BY_PURPOSE: Record<string, string> = {
  business: 'Your Business Knows No Borders',
  tourism: 'Your Next Adventure Awaits',
  work: 'Your Career Knows No Borders',
  study: 'Your Future Starts Here',
  family: 'Travel Together, Simply',
  medical: 'Care Without Borders',
  transit: 'Smooth Travels Ahead',
};

function visaKindLabel(purpose: string) {
  return formatVisaKindLabel({ purpose });
}

function headlineVisaLabel(kind: string) {
  return /visa/i.test(kind) ? kind : `${kind} Visa`;
}

function heroDescription(
  countryName: string,
  purpose: string,
  fallback: string
) {
  if (purpose === 'business') {
    return `Attend meetings, explore opportunities and grow your business in ${countryName} with a hassle-free visa application process.`;
  }
  if (purpose === 'tourism') {
    return `Explore ${countryName} with a guided visa application — clear documents, transparent fees, and support built for Indian travellers.`;
  }
  if (purpose === 'study') {
    return `Start your studies in ${countryName} with a guided application, document checks, and a timeline you can actually follow.`;
  }
  if (purpose === 'work') {
    return `Move forward on your ${countryName} work visa with transparent fees and a process designed for Indian applicants.`;
  }

  const firstSentence = fallback.split(/(?<=\.)\s/)[0];
  return firstSentence || fallback;
}

function InfoPills({
  countryName,
  countryFlag,
  flagUrl,
  pillVisaLabel,
  processingEta,
  compact = false,
}: {
  countryName: string;
  countryFlag: string;
  flagUrl?: string | null;
  pillVisaLabel: string;
  processingEta?: string | null;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? 'flex flex-wrap gap-2'
          : 'flex flex-col gap-2 sm:flex-row sm:items-center'
      }
    >
      <div className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-full bg-white px-3 py-2 text-portrait-ink shadow-[0_10px_30px_rgba(8,48,76,0.18)] sm:gap-3 sm:px-4 sm:py-3">
        <span className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-sky-wash sm:h-10 sm:w-10">
          {flagUrl ? (
            <Image
              src={flagUrl}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-base sm:text-lg">
              {countryFlag}
            </span>
          )}
        </span>
        <span className="min-w-0 pr-1">
          <span className="block truncate text-[13px] font-semibold leading-tight sm:text-sm">
            {countryName}
          </span>
          <span className="block truncate text-[11px] text-slate-helper sm:text-xs">
            {pillVisaLabel}
          </span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 rounded-full bg-white px-3 py-2 text-portrait-ink shadow-[0_10px_30px_rgba(8,48,76,0.18)] sm:gap-3 sm:px-4 sm:py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8f1ff] sm:h-10 sm:w-10">
          <CalendarDays className="h-3.5 w-3.5 text-[#2f6bff] sm:h-4 sm:w-4" aria-hidden />
        </span>
        <span>
          <span className="block text-[11px] text-slate-helper sm:text-xs">
            Processing time from
          </span>
          <span className="block text-[13px] font-semibold leading-tight sm:text-sm">
            {processingEta || 'Shared after review'}
          </span>
        </span>
      </div>
    </div>
  );
}

export interface ListingHeroProps {
  countryName: string;
  countryFlag: string;
  flagUrl?: string | null;
  heroImageUrl?: string | null;
  heroImageAlt?: string | null;
  purpose: string;
  entryType?: string | null;
  processName: string;
  overview: string;
  processingEta?: string | null;
}

export function ListingHero({
  countryName,
  countryFlag,
  flagUrl,
  heroImageUrl,
  heroImageAlt,
  purpose,
  entryType,
  processName,
  overview,
  processingEta,
}: ListingHeroProps) {
  const kind = visaKindLabel(purpose);
  const visaTitle = headlineVisaLabel(kind);
  const applyLabel = `Apply for ${countryName} ${visaTitle}`;
  const pillVisaLabel = entryType ? `${visaTitle} (${entryType})` : visaTitle;
  const description = heroDescription(countryName, purpose, overview);
  const scriptLine =
    SCRIPT_BY_PURPOSE[purpose] || 'Your Global Journey Starts Here';

  const pills = (
    <InfoPills
      countryName={countryName}
      countryFlag={countryFlag}
      flagUrl={flagUrl}
      pillVisaLabel={pillVisaLabel}
      processingEta={processingEta}
    />
  );

  return (
    <section className="relative isolate overflow-hidden bg-[#062445] text-white">
      {heroImageUrl && (
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] lg:block">
          <Image
            src={heroImageUrl}
            alt={heroImageAlt || countryName}
            fill
            priority
            sizes="58vw"
            className="object-cover object-[center_30%]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#062445] from-0% via-[#062445]/50 via-[22%] to-transparent to-[68%]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#062445] from-0% via-[#062445]/20 via-[18%] to-transparent" />
        </div>
      )}

      {/* Mobile / tablet: photo first, pills in flow so they never collide with the sticky header. */}
      <div className="lg:hidden">
        <div className="relative h-[34vh] min-h-[200px] max-h-[280px]">
          {heroImageUrl ? (
            <Image
              src={heroImageUrl}
              alt={heroImageAlt || countryName}
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-white/8 text-7xl">
              {countryFlag}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#062445] from-15% via-[#062445]/35 to-black/30" />
        </div>

        <div className="relative z-10 px-4 pb-[4.75rem] sm:px-6 sm:pb-20">
          <div className="-mt-7">
            <InfoPills
              countryName={countryName}
              countryFlag={countryFlag}
              flagUrl={flagUrl}
              pillVisaLabel={pillVisaLabel}
              processingEta={processingEta}
              compact
            />
          </div>

          <p className="mt-6 text-[10px] font-medium uppercase tracking-[0.2em] text-white/65">
            Your global journey starts here
          </p>
          <h1 className="mt-2.5 font-basier text-[1.7rem] leading-[1.1] tracking-[-0.03em] sm:text-4xl">
            {countryName} {visaTitle}
            <span className="mt-0.5 block text-[#7ec8ff]">for Indians</span>
          </h1>
          <p className="mt-3 text-[14px] leading-6 text-white/78 sm:text-[15px] sm:leading-7">
            {description}
          </p>

          <ul className="mt-5 flex flex-col gap-2.5">
            {TRUST_ITEMS.map(({ title, subtitle, Icon }) => (
              <li key={title} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10">
                  <Icon className="h-4 w-4 text-[#9ad4ff]" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold leading-tight text-white">
                    {title}
                  </span>
                  <span className="block text-[11px] text-white/60">{subtitle}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col gap-2.5">
            <a
              href="#pricing"
              className="group inline-flex w-full items-center justify-center rounded-full bg-[#2f6bff] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(47,107,255,0.35)]"
            >
              Apply now
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="#requirements"
              className="inline-flex w-full items-center justify-center rounded-full border border-white/35 bg-white/5 px-5 py-3.5 text-sm font-medium text-white"
            >
              Check Eligibility
            </a>
          </div>
        </div>
      </div>

      {/* Desktop */}
      <div className="relative mx-auto hidden max-w-7xl px-8 pb-28 pt-32 lg:block">
        <div className="grid grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] items-stretch gap-10">
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/70">
              Your global journey starts here
            </p>

            <h1 className="mt-4 font-basier text-[3.5rem] leading-[1.02] tracking-[-0.04em]">
              {countryName} {visaTitle}
              <span className="mt-1 block text-[#7ec8ff]">for Indians</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-8 text-white/78">
              {description}
            </p>

            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-3">
              {TRUST_ITEMS.map(({ title, subtitle, Icon }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10">
                    <Icon className="h-4 w-4 text-[#9ad4ff]" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      {title}
                    </span>
                    <span className="block text-xs text-white/60">{subtitle}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex items-center gap-3">
              <a
                href="#pricing"
                className="group inline-flex items-center justify-center rounded-full bg-[#2f6bff] px-6 py-3.5 text-base font-semibold text-white shadow-[0_10px_24px_rgba(47,107,255,0.35)] transition-transform duration-200 hover:bg-[#3b78ff] active:scale-[0.98]"
              >
                {applyLabel}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="#requirements"
                className="inline-flex items-center justify-center rounded-full border border-white/35 bg-white/5 px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-white/10"
              >
                Check Eligibility
              </a>
            </div>
          </div>

          <div className="relative min-h-[420px]">
            <p className="font-script pointer-events-none absolute right-[8%] top-[18%] max-w-[220px] -rotate-[8deg] text-right text-3xl leading-tight text-white/90 xl:text-4xl">
              {scriptLine}
            </p>
            <div className="absolute bottom-2 right-0">{pills}</div>
          </div>
        </div>
      </div>

      <HeroWave />
      <span className="sr-only">{processName}</span>
    </section>
  );
}
