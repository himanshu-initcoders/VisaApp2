import { cn } from '@/lib/utils';

const VARIANTS = [
  { bg: '#E8F1FF', skin: '#E6B089', hair: '#2C1B12', shirt: '#3B82F6' },
  { bg: '#F3E8FF', skin: '#C48A62', hair: '#4A2C17', shirt: '#8B5CF6' },
  { bg: '#E8FFF3', skin: '#D4A074', hair: '#1F140E', shirt: '#0EA5E9' },
  { bg: '#FFE8F1', skin: '#E8C4A8', hair: '#3B2214', shirt: '#F43F5E' },
  { bg: '#FFF4E0', skin: '#C48A62', hair: '#111111', shirt: '#F59E0B' },
  { bg: '#E6F7FF', skin: '#E6B089', hair: '#5C3317', shirt: '#084E72' },
];

interface ProfileAvatarProps {
  name: string;
  variant: number;
  src?: string;
  className?: string;
}

export function ProfileAvatar({
  name,
  variant,
  src,
  className,
}: ProfileAvatarProps) {
  const palette = VARIANTS[Math.abs(variant) % VARIANTS.length];
  const longHair = variant % 2 === 1;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={cn('h-16 w-16 rounded-full object-cover', className)}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('h-16 w-16 rounded-full', className)}
      role="img"
      aria-label={name}
    >
      <circle cx="32" cy="32" r="32" fill={palette.bg} />
      {longHair && (
        <path
          d="M16 34c1-14 9-22 16-22s15 8 16 22c-3-6-8-9-16-9s-13 3-16 9z"
          fill={palette.hair}
        />
      )}
      <circle cx="32" cy="26" r="11" fill={palette.skin} />
      <path
        d={
          longHair
            ? 'M18 26c1-9 7-14 14-14s13 5 14 14c-2-5-7-8-14-8s-12 3-14 8z'
            : 'M21 22c1-7 5-11 11-11s10 4 11 11c-3-4-7-6-11-6s-8 2-11 6z'
        }
        fill={palette.hair}
      />
      <ellipse cx="32" cy="58" rx="18" ry="14" fill={palette.shirt} />
      <circle cx="27.5" cy="25" r="1.2" fill="#3A2A22" />
      <circle cx="36.5" cy="25" r="1.2" fill="#3A2A22" />
      <path
        d="M29 30.5c1.2 1.4 4.8 1.4 6 0"
        stroke="#C07A5A"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
