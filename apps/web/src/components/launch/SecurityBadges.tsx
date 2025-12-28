'use client';

interface Badge {
  icon: React.ReactNode;
  label: string;
  description: string;
}

const badges: Badge[] = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
    label: 'E2E Encrypted',
    description: 'Messages encrypted on your device before transmission',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
    label: 'Signal Protocol',
    description: 'Industry-standard encryption used by billions',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
        />
      </svg>
    ),
    label: 'Open Source',
    description: 'Fully auditable code on GitHub',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
        />
      </svg>
    ),
    label: 'Zero Knowledge',
    description: 'We cannot read your messages',
  },
];

function BadgeItem({ badge }: { badge: Badge }) {
  return (
    <div
      className="
        group relative flex items-center gap-2
        px-4 py-2 rounded-full
        bg-zinc-900/50 border border-zinc-800/50
        hover:border-amber-500/30 hover:bg-zinc-800/50
        transition-all duration-200
      "
    >
      <span className="text-amber-500">{badge.icon}</span>
      <span className="text-sm text-zinc-300">{badge.label}</span>

      {/* Tooltip */}
      <div
        className="
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          px-3 py-2 rounded-xl
          bg-zinc-800 border border-zinc-700
          text-xs text-zinc-300
          whitespace-nowrap
          opacity-0 group-hover:opacity-100
          pointer-events-none
          transition-opacity duration-200
          z-10
        "
      >
        {badge.description}
        <div
          className="
            absolute top-full left-1/2 -translate-x-1/2
            border-4 border-transparent border-t-zinc-800
          "
        />
      </div>
    </div>
  );
}

export function SecurityBadges() {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {badges.map((badge) => (
        <BadgeItem key={badge.label} badge={badge} />
      ))}
    </div>
  );
}
