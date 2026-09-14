export function PassportHeroIllustration({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <svg
        viewBox="0 0 280 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        <ellipse cx="168" cy="118" rx="96" ry="78" fill="#E8F1FF" />
        <ellipse cx="188" cy="92" rx="38" ry="28" fill="#F4F8FF" />
        <circle cx="214" cy="48" r="4" fill="#C5DBF7" />
        <circle cx="92" cy="58" r="3" fill="#D6E6FA" />
        <circle cx="236" cy="168" r="5" fill="#D6E6FA" />

        <g transform="translate(168 54) rotate(12)">
          <rect width="78" height="118" rx="10" fill="#D7E8FB" />
          <rect x="8" y="14" width="62" height="8" rx="4" fill="#F7FBFF" />
          <rect x="8" y="30" width="46" height="6" rx="3" fill="#F7FBFF" />
          <rect x="8" y="44" width="54" height="6" rx="3" fill="#F7FBFF" />
          <rect x="8" y="58" width="38" height="6" rx="3" fill="#F7FBFF" />
          <rect x="48" y="86" width="18" height="18" rx="4" fill="#F7FBFF" />
        </g>

        <g transform="translate(98 46) rotate(-8)">
          <rect width="108" height="148" rx="14" fill="#1E4F9B" />
          <rect x="1.5" y="1.5" width="105" height="145" rx="12.5" stroke="#2C6BC4" />
          <circle cx="54" cy="64" r="26" fill="#2B6CB8" />
          <circle cx="54" cy="64" r="21" fill="none" stroke="#F4F8FF" strokeWidth="2.2" />
          <ellipse
            cx="54"
            cy="64"
            rx="8"
            ry="21"
            fill="none"
            stroke="#F4F8FF"
            strokeWidth="2.2"
          />
          <path
            d="M33 64h42M36 52h36M36 76h36"
            stroke="#F4F8FF"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <text
            x="54"
            y="118"
            textAnchor="middle"
            fill="#F4F8FF"
            fontFamily="Arial, sans-serif"
            fontSize="11"
            fontWeight="700"
            letterSpacing="2.4"
          >
            PASSPORT
          </text>
        </g>

        <g transform="translate(196 28)">
          <path
            d="M8 18c14-2 24-10 30-18l6 3c-3 10-4 18 2 26l-5 3c-6-6-14-7-24-5l-2 10-6-1 3-12c-4 1-8 3-10 6l-4-3c3-4 7-8 10-9z"
            fill="#7FA6D9"
          />
        </g>
      </svg>
    </div>
  );
}
