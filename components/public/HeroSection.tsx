'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface HeroSectionProps {
  totalApplications?: number;
}

export function HeroSection({ totalApplications = 1204 }: HeroSectionProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger animation on mount
    setIsVisible(true);
  }, []);

  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Background Image with Gradient */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-wash/40 via-white/60 to-white z-10" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'url(/images/hero-bg.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      </div>

      {/* Content */}
      <div
        className={`relative z-20 max-w-5xl mx-auto px-4 py-24 text-center transition-all duration-1000 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {/* Eyebrow/Kicker */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-mint-wash/60 backdrop-blur-sm rounded-full mb-6">
          <span className="text-xs font-medium text-portrait-ink uppercase tracking-wide">
            🌍 Trusted by travelers worldwide
          </span>
        </div>

        {/* Headline */}
        <h1
          className="font-basier text-[56px] md:text-[76px] leading-[1.1] text-portrait-ink mb-6"
          style={{ letterSpacing: '-4.25px' }}
        >
          Your travel documents,
          <br />
          <span className="italic bg-gradient-rainbow bg-clip-text text-transparent">
            simplified
          </span>
        </h1>

        {/* Subheadline */}
        <p className="font-switzer text-lg md:text-xl text-graphite max-w-2xl mx-auto mb-8">
          Skip the embassy queues. Get your visa approved online with our guaranteed
          approval process. Fast, secure, and hassle-free.
        </p>

        {/* Stat Pills */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
          {/* Validity Pill */}
          <div className="flex items-center gap-2 px-4 py-3 bg-white/80 backdrop-blur-md rounded-full border border-ash-divider/30 shadow-card">
            <div className="w-8 h-8 rounded-full bg-sky-wash flex items-center justify-center">
              <Calendar className="h-4 w-4 text-portrait-ink" />
            </div>
            <div className="text-left">
              <div className="text-xs text-slate-helper">Validity</div>
              <div className="text-sm font-medium text-portrait-ink">Up to 5 years</div>
            </div>
          </div>

          {/* Purpose Pill */}
          <div className="flex items-center gap-2 px-4 py-3 bg-white/80 backdrop-blur-md rounded-full border border-ash-divider/30 shadow-card">
            <div className="w-8 h-8 rounded-full bg-mint-wash flex items-center justify-center">
              <Users className="h-4 w-4 text-portrait-ink" />
            </div>
            <div className="text-left">
              <div className="text-xs text-slate-helper">Purpose</div>
              <div className="text-sm font-medium text-portrait-ink">Tourist & Business</div>
            </div>
          </div>

          {/* Processing Pill */}
          <div className="flex items-center gap-2 px-4 py-3 bg-white/80 backdrop-blur-md rounded-full border border-ash-divider/30 shadow-card">
            <div className="w-8 h-8 rounded-full bg-peach-wash flex items-center justify-center">
              <Clock className="h-4 w-4 text-portrait-ink" />
            </div>
            <div className="text-left">
              <div className="text-xs text-slate-helper">Processing</div>
              <div className="text-sm font-medium text-portrait-ink">24-48 hours</div>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <Link href="#visas">
            <Button
              variant="primary"
              size="lg"
              className="group"
            >
              Browse destinations
              <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>

          <Link href="/how-it-works">
            <Button variant="ghost" size="lg">
              How it works
            </Button>
          </Link>
        </div>

        {/* Live Activity Microcopy */}
        <div className="flex items-center justify-center gap-2 text-sm text-slate-helper">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-nautical-teal opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-nautical-teal" />
          </span>
          <span>
            {totalApplications.toLocaleString()} travelers applied this week
          </span>
        </div>
      </div>

      {/* Bottom Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent z-10" />
    </section>
  );
}
