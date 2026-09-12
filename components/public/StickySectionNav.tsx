'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface StickySectionNavProps {
  items: Array<{
    id: string;
    label: string;
  }>;
  className?: string;
}

export function StickySectionNav({
  items,
  className,
}: StickySectionNavProps) {
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const [activeId, setActiveId] = useState(itemIds[0] || '');

  useEffect(() => {
    const sections = itemIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (first, second) =>
              second.intersectionRatio - first.intersectionRatio
          )[0];

        if (visibleSection?.target?.id) {
          setActiveId(visibleSection.target.id);
        }
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: [0.2, 0.45, 0.75],
      }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [itemIds]);

  return (
    <div
      className={cn(
        'sticky top-[60px] z-30 border-b border-ash-divider/70 bg-white/90 backdrop-blur sm:top-[55px]',
        className
      )}
    >
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:gap-2 sm:px-6 sm:py-3 lg:px-8">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={cn(
              'relative shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors active:scale-95',
              activeId === item.id
                ? 'bg-portrait-ink text-white'
                : 'text-slate-helper hover:bg-sky-wash/50 hover:text-portrait-ink'
            )}
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}
