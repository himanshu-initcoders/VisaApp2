import { cn } from '@/lib/utils';

/** Full-width cream wave that sits flush on the bottom of a navy hero. */
export function HeroWave({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[52px] sm:h-[64px] lg:h-[72px]',
        className
      )}
    >
      <svg
        viewBox="0 0 1440 72"
        preserveAspectRatio="none"
        className="block h-full w-full"
      >
        <path
          d="M0 72V28C180 52 360 64 540 46C720 28 900 8 1080 18C1260 28 1350 38 1440 24V72H0Z"
          fill="#f8f6f1"
        />
        <rect x="0" y="71" width="1440" height="2" fill="#f8f6f1" />
      </svg>
    </div>
  );
}
