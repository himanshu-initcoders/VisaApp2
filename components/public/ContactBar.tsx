import { Mail, MapPin, Phone, ArrowUpRight } from 'lucide-react';
import { MotionReveal } from '@/components/public/MotionReveal';
import {
  CONTACT_ADDRESS,
  CONTACT_EMAIL,
  CONTACT_MAPS_URL,
  CONTACT_PHONE,
} from '@/lib/contact';
import { cn } from '@/lib/utils';

export {
  CONTACT_ADDRESS,
  CONTACT_EMAIL,
  CONTACT_MAPS_URL,
  CONTACT_PHONE,
} from '@/lib/contact';

interface ContactBarProps {
  className?: string;
}

export function ContactBar({ className }: ContactBarProps) {
  return (
    <section
      aria-label="Contact Information"
      className={cn('mx-auto max-w-7xl px-4 pb-12 sm:px-6 sm:pb-20 lg:px-8', className)}
    >
      <MotionReveal>
        <div className="overflow-hidden rounded-[24px] border border-ash/70 bg-white p-6 shadow-card sm:rounded-[32px] sm:p-8 lg:p-10">
          <div className="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-helper sm:text-xs sm:tracking-[0.24em]">
                Get in touch
              </p>
              <h2 className="mt-2 font-basier text-2xl font-semibold leading-tight tracking-[-0.03em] text-portrait-ink sm:text-3xl">
                We&apos;re here to help you travel
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-helper sm:text-base">
                Have questions regarding visa requirements, passport processing, or your application? Contact our team directly.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Phone Card */}
            <a
              href={`tel:${CONTACT_PHONE}`}
              className="group relative flex flex-col justify-between rounded-[20px] border border-ash/60 bg-[#faf8f5] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-portrait-ink/20 hover:bg-white hover:shadow-md sm:p-6"
              aria-label={`Call us at ${CONTACT_PHONE}`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-wash text-portrait-ink transition-colors duration-200 group-hover:bg-portrait-ink group-hover:text-white">
                    <Phone className="h-5 w-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-helper transition-colors group-hover:text-portrait-ink">
                    Call now
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
                    Phone
                  </p>
                  <p className="mt-1 font-basier text-base font-semibold text-portrait-ink sm:text-lg">
                    {CONTACT_PHONE}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-helper">
                Available Mon – Sat, 10:00 AM – 8:00 PM
              </p>
            </a>

            {/* Email Card */}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="group relative flex flex-col justify-between rounded-[20px] border border-ash/60 bg-[#faf8f5] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-portrait-ink/20 hover:bg-white hover:shadow-md sm:p-6"
              aria-label={`Email us at ${CONTACT_EMAIL}`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-wash text-portrait-ink transition-colors duration-200 group-hover:bg-portrait-ink group-hover:text-white">
                    <Mail className="h-5 w-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-helper transition-colors group-hover:text-portrait-ink">
                    Send email
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
                    Email
                  </p>
                  <p className="mt-1 font-basier text-base font-semibold text-portrait-ink sm:text-lg">
                    {CONTACT_EMAIL}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-helper">
                Prompt response within 24 business hours
              </p>
            </a>

            {/* Address Card */}
            <a
              href={CONTACT_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex flex-col justify-between rounded-[20px] border border-ash/60 bg-[#faf8f5] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-portrait-ink/20 hover:bg-white hover:shadow-md sm:col-span-2 sm:p-6 lg:col-span-1"
              aria-label={`Visit our office at ${CONTACT_ADDRESS}`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-wash text-portrait-ink transition-colors duration-200 group-hover:bg-portrait-ink group-hover:text-white">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-helper transition-colors group-hover:text-portrait-ink">
                    View on map
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-helper">
                    Address
                  </p>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-portrait-ink sm:text-[15px]">
                    {CONTACT_ADDRESS}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-helper">
                Head office in Bengaluru, Karnataka
              </p>
            </a>
          </div>
        </div>
      </MotionReveal>
    </section>
  );
}
