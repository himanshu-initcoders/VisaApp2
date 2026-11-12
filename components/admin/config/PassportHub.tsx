import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  DollarSign,
  FileText,
  FileCheck,
  HelpCircle,
  Settings,
} from 'lucide-react';

interface PassportHubProps {
  listingId: string;
  stats: {
    tiersCount: number;
    questionsCount: number;
    documentsCount: number;
    faqsCount: number;
    stepsCount: number;
  };
}

export function PassportHub({ listingId, stats }: PassportHubProps) {
  const cards = [
    {
      title: 'Basic Info',
      description: 'Name, ETA, and active status',
      icon: <Settings className="h-6 w-6" />,
      href: `/admin/config/passport-listings/${listingId}/basic`,
      color: 'sky' as const,
    },
    {
      title: 'Pricing',
      description: `${stats.tiersCount} price package${stats.tiersCount !== 1 ? 's' : ''}`,
      count: stats.tiersCount,
      icon: <DollarSign className="h-6 w-6" />,
      href: `/admin/config/passport-listings/${listingId}/tiers`,
      color: 'mint' as const,
    },
    {
      title: 'Form Builder',
      description: `${stats.stepsCount} step${stats.stepsCount !== 1 ? 's' : ''}, ${stats.questionsCount} question${stats.questionsCount !== 1 ? 's' : ''}`,
      count: stats.questionsCount,
      icon: <FileText className="h-6 w-6" />,
      href: `/admin/config/passport-listings/${listingId}/forms`,
      color: 'peach' as const,
    },
    {
      title: 'Documents',
      description: `${stats.documentsCount} document${stats.documentsCount !== 1 ? 's' : ''} required`,
      count: stats.documentsCount,
      icon: <FileCheck className="h-6 w-6" />,
      href: `/admin/config/passport-listings/${listingId}/docs`,
      color: 'sky' as const,
    },
    {
      title: 'Content & Help',
      description: `${stats.faqsCount} FAQ${stats.faqsCount !== 1 ? 's' : ''}`,
      count: stats.faqsCount,
      icon: <HelpCircle className="h-6 w-6" />,
      href: `/admin/config/passport-listings/${listingId}/content`,
      color: 'peach' as const,
    },
  ];

  const getColorClasses = (color: 'mint' | 'sky' | 'peach') => {
    switch (color) {
      case 'mint':
        return { bg: 'bg-mint-wash', icon: 'text-portrait-ink' };
      case 'sky':
        return { bg: 'bg-sky-wash', icon: 'text-portrait-ink' };
      case 'peach':
        return { bg: 'bg-peach-wash', icon: 'text-portrait-ink' };
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((card) => {
        const colors = getColorClasses(card.color);
        return (
          <Link
            key={card.href}
            href={card.href}
            className={cn(
              'block bg-white border border-ash-divider rounded-3xl p-6',
              'transition-all duration-200',
              'hover:shadow-card hover:scale-[1.02]'
            )}
          >
            <div
              className={cn(
                'inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-4',
                colors.bg,
                colors.icon
              )}
            >
              {card.icon}
            </div>
            <h3 className="text-lg font-medium text-portrait-ink mb-1">
              {card.title}
            </h3>
            <p className="text-sm text-slate-helper">{card.description}</p>
          </Link>
        );
      })}
    </div>
  );
}
