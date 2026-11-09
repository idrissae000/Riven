import Link from "next/link";

/** A riven "disc": brass rhombus, inner rhombus, teal core. Hand-drawn SVG, no icon font. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 1.5 30.5 16 16 30.5 1.5 16 16 1.5Z" stroke="#d8b46a" strokeWidth="1.6" />
      <path d="M16 7 25 16 16 25 7 16 16 7Z" fill="#d8b46a" fillOpacity="0.14" stroke="#d8b46a" strokeOpacity="0.55" strokeWidth="1" />
      <path d="M16 11.5 20.5 16 16 20.5 11.5 16 16 11.5Z" fill="#3ad8c6" />
      <path d="M16 1.5v4M16 26.5v4M1.5 16h4M26.5 16h4" stroke="#d8b46a" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ href = "/rivens", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5" aria-label="Riven Buddy home">
      <LogoMark size={compact ? 26 : 32} />
      <span className="leading-none">
        <span className={`block font-display font-bold tracking-[0.2em] text-gold ${compact ? "text-lg" : "text-[1.4rem]"}`}>RIVEN</span>
        <span className="mt-0.5 block text-[0.6rem] font-semibold tracking-[0.5em] text-dim transition-colors group-hover:text-teal">BUDDY</span>
      </span>
    </Link>
  );
}

/** Platinum: a small hex coin, used instead of a bare "p". */
export function Plat({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={`inline-block shrink-0 align-[-0.12em] ${className}`} aria-label="platinum" role="img">
      <path d="M8 .8 14.4 4.4v7.2L8 15.2 1.6 11.6V4.4L8 .8Z" fill="#8fd2ff" />
      <path d="M8 3.6 11.9 5.8v4.4L8 12.4 4.1 10.2V5.8L8 3.6Z" fill="#06121c" />
      <path d="M8 5.6 9.9 6.8v2.4L8 10.4 6.1 9.2V6.8L8 5.6Z" fill="#8fd2ff" />
    </svg>
  );
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function IconRiven({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M7 2.5h10l3 3v13l-3 3H7l-3-3v-13l3-3Z" />
      <path d="M8 8.5h8M8 12h8M8 15.5h4.5" />
    </svg>
  );
}
export function IconArcane({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M12 2.5 14.2 9.8 21.5 12 14.2 14.2 12 21.5 9.8 14.2 2.5 12 9.8 9.8 12 2.5Z" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
export function IconMarket({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z" />
      <path d="M9 9.5h4.2a2 2 0 0 1 0 4H9m0-4v7" />
    </svg>
  );
}
