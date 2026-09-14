import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FilledBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#00cc3d] text-white',
        className
      )}
      aria-label="Application filled"
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </span>
  );
}
