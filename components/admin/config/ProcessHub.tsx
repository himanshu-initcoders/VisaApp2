import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  DollarSign,
  FileText,
  FileCheck,
  HelpCircle,
  Settings,
} from 'lucide-react';

interface ProcessHubCard {
  title: string;
  description: string;
  count?: number;
  icon: React.ReactNode;
  href: string;
  color: 'mint' | 'sky' | 'peach';
}

interface ProcessHubProps {
  processId: string;
  stats: {
    tiersCount: number;
    questionsCount: number;
    documentsCount: number;
    faqsCount: number;
  };
}

/**
 * ProcessHub Component
 *
 * Hub cards for managing all aspects of a visa listing:
 * 1. Basic Info
 * 2. Pricing & Tiers
 * 3. Form Builder (dynamic questions)
 * 4. Documents (requirements)
 * 5. Content & Help (FAQs, steps)
 */
export function ProcessHub({ processId, stats }: ProcessHubProps) {
  const cards: ProcessHubCard[] = [
    {
      title: 'Basic Info',
      description: 'Visa name, type, purpose, and ETA',
      icon: <Settings className="h-6 w-6" />,
      href: `/admin/config/visa-listings/${processId}/basic`,
      color: 'sky',
    },
    {
      title: 'Pricing',
      description: `${stats.tiersCount} price package${stats.tiersCount !== 1 ? 's' : ''}`,
      count: stats.tiersCount,
      icon: <DollarSign className="h-6 w-6" />,
      href: `/admin/config/visa-listings/${processId}/tiers`,
      color: 'mint',
    },
    {
      title: 'Form Builder',
      description: `${stats.questionsCount} dynamic question${stats.questionsCount !== 1 ? 's' : ''}`,
      count: stats.questionsCount,
      icon: <FileText className="h-6 w-6" />,
      href: `/admin/config/visa-listings/${processId}/forms`,
      color: 'peach',
    },
    {
      title: 'Documents',
      description: `${stats.documentsCount} document${stats.documentsCount !== 1 ? 's' : ''} required`,
      count: stats.documentsCount,
      icon: <FileCheck className="h-6 w-6" />,
      href: `/admin/config/visa-listings/${processId}/docs`,
      color: 'sky',
    },
    {
      title: 'Content & Help',
      description: `${stats.faqsCount} FAQ${stats.faqsCount !== 1 ? 's' : ''} and timeline steps`,
      count: stats.faqsCount,
      icon: <HelpCircle className="h-6 w-6" />,
      href: `/admin/config/visa-listings/${processId}/content`,
      color: 'peach',
    },
  ];

  const getColorClasses = (color: 'mint' | 'sky' | 'peach') => {
    switch (color) {
      case 'mint':
        return {
          bg: 'bg-mint-wash',
          hover: 'hover:bg-mint-wash/70',
          icon: 'text-portrait-ink',
        };
      case 'sky':
        return {
          bg: 'bg-sky-wash',
          hover: 'hover:bg-sky-wash/70',
          icon: 'text-portrait-ink',
        };
      case 'peach':
        return {
          bg: 'bg-peach-wash',
          hover: 'hover:bg-peach-wash/70',
          icon: 'text-portrait-ink',
        };
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
            {/* Icon */}
            <div
              className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center mb-4',
                colors.bg
              )}
            >
              <div className={colors.icon}>{card.icon}</div>
            </div>

            {/* Title with optional count */}
            <div className="flex items-start justify-between mb-2">
              <h3
                className="text-xl font-medium text-portrait-ink"
                style={{ fontFamily: 'Basier Circle' }}
              >
                {card.title}
              </h3>
              {card.count !== undefined && (
                <span
                  className={cn(
                    'inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-medium',
                    colors.bg,
                    'text-portrait-ink'
                  )}
                >
                  {card.count}
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-slate-helper mb-4">{card.description}</p>

            {/* Manage link */}
            <div className="flex items-center text-sm font-medium text-nautical-teal group-hover:text-portrait-ink transition-colors">
              Manage
              <svg
                className="w-4 h-4 ml-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
