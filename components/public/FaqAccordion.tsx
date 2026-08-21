'use client';

import { useMemo, useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { MotionReveal } from '@/components/public/MotionReveal';
import { cn } from '@/lib/utils';

export function FaqAccordion({
  faqs,
}: {
  faqs: Array<{
    id: string;
    question: string;
    answer: string;
  }>;
}) {
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);

  const filteredFaqs = useMemo(() => {
    if (!query.trim()) return faqs;

    const normalizedQuery = query.toLowerCase();
    return faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(normalizedQuery) ||
        faq.answer.toLowerCase().includes(normalizedQuery)
    );
  }, [faqs, query]);

  return (
    <div className="space-y-3 sm:space-y-5">
      {faqs.length >= 6 && (
        <div className="flex items-center gap-3 rounded-2xl border border-ash-divider bg-white px-4 py-3.5 shadow-card sm:rounded-[24px] sm:py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-helper" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search visa questions"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-portrait-ink outline-none placeholder:text-slate-helper sm:text-sm"
          />
        </div>
      )}

      <div className="space-y-3 sm:space-y-4">
        {filteredFaqs.map((faq, index) => {
          const isOpen = openId === faq.id;

          return (
            <MotionReveal key={faq.id} delayMs={index * 50}>
              <div className="overflow-hidden rounded-2xl border border-ash-divider bg-white shadow-card sm:rounded-[26px]">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left sm:gap-4 sm:px-6 sm:py-5"
                  onClick={() =>
                    setOpenId((currentOpenId) =>
                      currentOpenId === faq.id ? null : faq.id
                    )
                  }
                >
                  <span className="text-[15px] font-medium leading-snug text-portrait-ink sm:text-base">
                    {faq.question}
                  </span>
                  <Plus
                    className={cn(
                      'h-5 w-5 flex-shrink-0 text-slate-helper transition-transform duration-300',
                      isOpen && 'rotate-45 text-portrait-ink'
                    )}
                  />
                </button>
                <div
                  className={cn(
                    'grid transition-all duration-300 ease-out',
                    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-ash-divider px-5 py-4 text-[15px] leading-7 text-slate-helper sm:px-6 sm:py-5 sm:text-sm">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              </div>
            </MotionReveal>
          );
        })}
      </div>
    </div>
  );
}
