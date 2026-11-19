import {
  ArrowRight,
  CalendarDays,
  Clock,
  Receipt,
  ShieldCheck,
} from 'lucide-react';
import { HeroWave } from '@/components/public/HeroWave';
import { MediaImage } from '@/components/shared/MediaImage';
import { formatVisaKindLabel } from '@/lib/public';
import { toAppMediaUrl } from '@/lib/upload/mediaUrl';

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
  withFreeInsurance = false,
  className,
}: {
  countryName: string;
  countryFlag: string;
  flagUrl?: string | null;
  pillVisaLabel: string;
  processingEta?: string | null;
  withFreeInsurance?: boolean;
  className?: string;
}) {
  return (
    <div
      className={['flex flex-wrap gap-2 sm:items-center', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-full border border-[#B7C9DC]/50 bg-[#FFFFFF] px-3 py-2 text-[#102B4E] shadow-[0_8px_24px_rgba(16,43,78,0.08)] sm:gap-3 sm:px-4 sm:py-3">
        <span className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#E8F1FF] sm:h-10 sm:w-10">
          {flagUrl ? (
            <MediaImage
              src={flagUrl}
              alt={`${countryName} flag`}
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
          <span className="block truncate text-[11px] text-[#52657D] sm:text-xs">
            {pillVisaLabel}
          </span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2.5 rounded-full border border-[#B7C9DC]/50 bg-[#FFFFFF] px-3 py-2 text-[#102B4E] shadow-[0_8px_24px_rgba(16,43,78,0.08)] sm:gap-3 sm:px-4 sm:py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8F1FF] sm:h-10 sm:w-10">
          <CalendarDays className="h-3.5 w-3.5 text-[#2563EB] sm:h-4 sm:w-4" aria-hidden />
        </span>
        <span>
          <span className="block text-[11px] text-[#52657D] sm:text-xs">
            Processing time from
          </span>
          <span className="block text-[13px] font-semibold leading-tight sm:text-sm">
            {processingEta || 'Shared after review'}
          </span>
        </span>
      </div>

      {withFreeInsurance && (
        <div className="flex shrink-0 items-center gap-2.5 rounded-full border border-[#B7C9DC]/50 bg-[#FFFFFF] px-3 py-2 text-[#102B4E] shadow-[0_8px_24px_rgba(16,43,78,0.08)] sm:gap-3 sm:px-4 sm:py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8F1FF] sm:h-10 sm:w-10">
            <ShieldCheck className="h-3.5 w-3.5 text-[#087F8C] sm:h-4 sm:w-4" aria-hidden />
          </span>
          <span>
            <span className="block text-[11px] text-[#52657D] sm:text-xs">
              Included with visa
            </span>
            <span className="block text-[13px] font-semibold leading-tight sm:text-sm">
              Free Insurance
            </span>
          </span>
        </div>
      )}
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
  withFreeInsurance?: boolean;
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
  withFreeInsurance = false,
}: ListingHeroProps) {
  const kind = visaKindLabel(purpose);
  const visaTitle = headlineVisaLabel(kind);
  const applyLabel = `Apply for ${countryName} ${visaTitle}`;
  const pillVisaLabel = entryType ? `${visaTitle} (${entryType})` : visaTitle;
  const description = heroDescription(countryName, purpose, overview);
  const scriptLine =
    SCRIPT_BY_PURPOSE[purpose] || 'Your Global Journey Starts Here';
  const resolvedFlagUrl = toAppMediaUrl(flagUrl) || flagUrl;
  const resolvedHeroUrl = toAppMediaUrl(heroImageUrl) || heroImageUrl;

  return (
    <section className="relative isolate overflow-hidden bg-[#F3F8FF] text-[#102B4E]">
      {/* Single hero image — mobile banner + desktop right panel */}
      {resolvedHeroUrl ? (
        <div className="relative h-[34vh] min-h-[200px] max-h-[280px] lg:pointer-events-none lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:max-h-none lg:min-h-0 lg:w-[58%]">
          <MediaImage
            src={resolvedHeroUrl}
            alt={heroImageAlt || countryName}
            fill
            priority
            quality={90}
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="object-cover object-center lg:object-[center_30%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#F3F8FF] from-10% via-[#F3F8FF]/50 to-transparent lg:bg-gradient-to-r lg:from-[#F3F8FF] lg:from-0% lg:via-[#F3F8FF]/70 lg:via-[22%] lg:to-transparent lg:to-[68%]" />
          <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-[#F3F8FF] from-0% via-[#F3F8FF]/40 via-[18%] to-transparent lg:block" />
        </div>
      ) : (
        <div className="relative flex h-[34vh] min-h-[200px] max-h-[280px] items-center justify-center bg-[#E8F1FF] text-7xl lg:hidden">
          {countryFlag}
        </div>
      )}

      <div className="relative z-10 px-4 pb-[4.75rem] sm:px-6 sm:pb-20 lg:mx-auto lg:max-w-7xl lg:px-8 lg:pb-28 lg:pt-32">
        {/* Mobile: pills overlap hero photo */}
        <div className="-mt-7 lg:hidden">
          <InfoPills
            countryName={countryName}
            countryFlag={countryFlag}
            flagUrl={resolvedFlagUrl}
            pillVisaLabel={pillVisaLabel}
            processingEta={processingEta}
            withFreeInsurance={withFreeInsurance}
          />
        </div>

        <div className="relative lg:min-h-[420px]">
          <div className="max-w-xl">
            <p className="mt-6 text-[10px] font-medium uppercase tracking-[0.2em] text-[#52657D] lg:mt-0 lg:text-xs lg:tracking-[0.22em]">
              Your global journey starts here
            </p>

            {/* One H1; trailing space before block span avoids "Visafor" in scrapers */}
            <h1 className="mt-2.5 font-basier text-[1.7rem] leading-[1.1] tracking-[-0.03em] text-[#102B4E] sm:text-4xl lg:mt-4 lg:text-[3.5rem] lg:leading-[1.02] lg:tracking-[-0.04em]">
              {`${countryName} ${visaTitle} `}
              <span className="mt-0.5 block text-[#2689D8] lg:mt-1">
                for Indians
              </span>
            </h1>

            <p className="mt-3 text-[14px] leading-6 text-[#52657D] sm:text-[15px] sm:leading-7 lg:mt-5 lg:max-w-lg lg:text-base lg:leading-8">
              {description}
            </p>

            <ul className="mt-5 flex flex-col gap-2.5 lg:mt-7 lg:flex-row lg:flex-wrap lg:gap-x-6 lg:gap-y-3">
              {TRUST_ITEMS.map(({ title, subtitle, Icon }) => (
                <li
                  key={title}
                  className="flex items-center gap-3 lg:items-start"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#B7C9DC]/60 bg-white lg:mt-0.5">
                    <Icon className="h-4 w-4 text-[#087F8C]" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight text-[#102B4E] lg:text-sm">
                      {title}
                    </span>
                    <span className="block text-[11px] text-[#52657D] lg:text-xs">
                      {subtitle}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Full-width row: CTAs left, flag/days right */}
          <div className="mt-6 flex w-full flex-col gap-2.5 lg:mt-8 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="flex w-full flex-col gap-2.5 lg:w-auto lg:flex-row lg:items-center lg:gap-3">
              <a
                href="#pricing"
                className="group inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-portrait-ink px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] transition-colors hover:bg-fog lg:w-auto lg:px-6 lg:text-base lg:active:scale-[0.98]"
              >
                <span className="lg:hidden">Apply now</span>
                <span className="hidden lg:inline">{applyLabel}</span>
                <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="#requirements"
                className="inline-flex w-full shrink-0 items-center justify-center rounded-full border border-[#B7C9DC] bg-white px-5 py-3.5 text-sm font-medium text-[#102B4E] transition-colors hover:bg-white/80 lg:w-auto lg:px-6 lg:text-base lg:hover:bg-[#F3F8FF]"
              >
                View requirements
              </a>
            </div>
            <InfoPills
              className="hidden lg:flex"
              countryName={countryName}
              countryFlag={countryFlag}
              flagUrl={resolvedFlagUrl}
              pillVisaLabel={pillVisaLabel}
              processingEta={processingEta}
              withFreeInsurance={withFreeInsurance}
            />
          </div>

          <p className="font-script pointer-events-none absolute right-[8%] top-[18%] hidden max-w-[220px] -rotate-[8deg] text-right text-3xl leading-tight text-[#102B4E]/80 lg:block xl:text-4xl">
            {scriptLine}
          </p>
        </div>
      </div>

      <HeroWave />
      <span className="sr-only">{processName}</span>
    </section>
  );
}
