interface LogoProps {
  size?: number;
}

/** A couch-shaped wave: the Couchwave mark. Same artwork as the favicon. */
export function Logo({ size = 36 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Couchwave">
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#ff5ca8" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#logo-gradient)" />
      <path
        d="M8 20c3-6 5-6 8 0s5 6 8 0"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
