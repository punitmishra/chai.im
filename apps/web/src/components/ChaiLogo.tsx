interface ChaiLogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

export function ChaiLogo({ size = 32, className = '', glow = false }: ChaiLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={glow ? { filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.6)) drop-shadow(0 0 20px rgba(6, 182, 212, 0.3))' } : undefined}
    >
      {/* Hexagonal shield outline */}
      <path
        d="M32 2L56 16V48L32 62L8 48V16L32 2Z"
        fill="currentColor"
        opacity={0.15}
      />
      <path
        d="M32 2L56 16V48L32 62L8 48V16L32 2Z"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {/* Inner shield bevel */}
      <path
        d="M32 8L50 19V45L32 56L14 45V19L32 8Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        opacity={0.4}
      />
      {/* Lock body */}
      <rect
        x={22}
        y={28}
        width={20}
        height={16}
        rx={3}
        fill="currentColor"
      />
      {/* Lock shackle */}
      <path
        d="M25 28V23C25 19.134 28.134 16 32 16C35.866 16 39 19.134 39 23V28"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
      />
      {/* Keyhole */}
      <circle cx={32} cy={35} r={2.5} fill="var(--color-dark-950, #0a0b10)" />
      <path
        d="M32 37L30.5 42H33.5L32 37Z"
        fill="var(--color-dark-950, #0a0b10)"
      />
    </svg>
  );
}
