'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface StickySectionNavProps {
  items: Array<{
    id: string;
    label: string;
  }>;
  className?: string;
  /** Reset active tab when the soft-switched listing changes. */
  resetKey?: string;
}

export function StickySectionNav({
  items,
  className,
  resetKey,
}: StickySectionNavProps) {
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const [activeId, setActiveId] = useState(itemIds[0] || '');

  useEffect(() => {
    setActiveId(itemIds[0] || '');
  }, [resetKey, itemIds]);

  useEffect(() => {
    const sections = itemIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));

    let pausedUntil = 0;
    if (resetKey) {
      // Ignore observer churn while sibling listing content settles.
      pausedUntil = performance.now() + 450;
      setActiveId(itemIds[0] || 'overview');
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (performance.now() < pausedUntil) return;

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
  }, [itemIds, resetKey]);

  const scrollToSection = (id: string) => {
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
    // Keep the hash in sync without a second native jump.
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <div
      className={cn(
        // Must clear the fixed Header when scrolled (py-2.5 + lg logo ≈ 64px).
        'sticky top-16 z-30 border-b border-ash-divider/70 bg-white/90 backdrop-blur',
        className
      )}
    >
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:gap-2 sm:px-6 sm:py-3 lg:px-8">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(event) => {
              event.preventDefault();
              scrollToSection(item.id);
            }}
            className={cn(
              'relative shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors active:scale-95',
              activeId === item.id
                ? 'bg-portrait-ink text-white'
                : 'text-iron hover:bg-sky-wash/50 hover:text-portrait-ink'
            )}
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}
