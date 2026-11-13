import Link from "next/link";

/** The logo: a riven "disc": brass rhombus, inner rhombus, teal core. Hand-drawn SVG, no icon font. */
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

export function Wordmark({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5" aria-label="Warframe Economist home">
      <LogoMark size={compact ? 26 : 32} />
      <span className="leading-none">
        <span className={`block font-display font-bold tracking-[0.14em] text-gold ${compact ? "text-base" : "text-[1.15rem]"}`}>WARFRAME</span>
        <span className="mt-1 block text-xs font-semibold tracking-[0.34em] text-dim transition-colors group-hover:text-teal">ECONOMIST</span>
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
      <g fill="currentColor" stroke="currentColor" strokeWidth=".8" strokeLinejoin="round">
      <path d="M2.4 3.1 8.2 2.1 4.6 8.4Z"/><path d="M21.6 3.1 15.8 2.1 19.4 8.4Z"/>
      <path d="M8.5 16.6h7L12 22.2Z"/></g>
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.7 7.1 12 4.2l2.3 2.9"/>
      <path d="M7.4 11.4 4.5 15.4h4M16.6 11.4l2.9 4h-4"/>
      <path d="M9 13.9 12 7.9l3 6Z" strokeWidth="1.1"/></g>
      <path d="M12 9.6 13.8 12.9H10.2Z" fill="currentColor"/>
    </svg>
  );
}

export function IconArcane({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.4 18a9.6 9.6 0 0 1 19.2 0Z" />
        <path d="M12 4.6v2.8" strokeWidth="2" />
        <path d="M5.2 8.6v2.4M18.8 8.6v2.4" strokeWidth="1.8" />
        <circle cx="12" cy="13.4" r="3.9" strokeWidth="1" />
        <path d="M12 10.4 8.95 15.9h6.1Z" strokeWidth="1" />
      </g>
      <g fill="currentColor" stroke="none"><circle cx="12" cy="10.5" r="1.15" /><circle cx="9" cy="15.3" r="1" /><circle cx="15" cy="15.3" r="1" /></g>
    </svg>
  );
}

export function IconPrime({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
  <path d="M10.5 5.6h3v11.7L12 19.2l-1.5-1.9Z"/>
  <path d="M12 1.9v3.4M8.3 3.4 11 5.7M15.7 3.4 13 5.7" strokeWidth="1.3"/>
  <path d="M4.6 4.9 8.6 7v10.4H6.7V9.2Z" strokeWidth="1.4"/>
  <path d="M19.4 4.9 15.4 7v10.4h1.9V9.2Z" strokeWidth="1.4"/>
  <path d="M5 15.8A7.9 7.9 0 1 1 19 15.8" strokeWidth="1.2"/>
  <path d="M6.7 19.3h2.4c.1 1.5-.3 2.5-.8 3.1M17.3 19.3h-2.4c-.1 1.5.3 2.5.8 3.1M12 20.6v1.8" strokeWidth="1.2"/></g>
    </svg>
  );
}

export function IconLive({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5V12l3.5 2" />
    </svg>
  );
}
export function IconBaro({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke} fill="currentColor" stroke="none">
      <path fillRule="evenodd" d="M11.96 2.0 15.54 5.95 14.29 5.95 12.04 3.39 11.69 3.66 9.67 5.95 8.46 5.95 11.96 2.04ZM12.0 4.38 12.27 4.56 13.48 5.95 12.85 5.95 12.58 5.45 12.09 5.23 11.51 5.36 11.1 5.95 10.61 5.95 12.0 4.42ZM11.96 5.9 13.39 7.47 14.33 6.48 15.54 6.48 14.06 8.23 17.7 12.27 16.57 12.27 12.04 7.2 11.6 7.56 7.43 12.27 6.26 12.27 9.94 8.19 8.46 6.48 9.67 6.48 10.3 7.25 10.61 7.47 11.96 5.95ZM5.41 7.7 7.16 9.62 6.13 9.62 5.5 8.86 5.18 9.09 4.78 9.62 3.7 9.62 5.41 7.74ZM18.46 7.7 20.21 9.62 19.17 9.62 18.5 8.86 17.78 9.62 16.75 9.62 18.46 7.74ZM11.96 8.37 12.18 8.5 15.5 12.27 14.24 12.27 14.11 11.64 13.66 10.88 12.99 10.34 12.31 10.12 11.46 10.16 10.7 10.52 9.98 11.37 9.71 12.27 8.46 12.27 11.96 8.41ZM3.7 10.16 4.74 10.16 5.41 10.92 5.72 10.7 6.13 10.16 7.16 10.16 7.16 10.25 5.41 12.09 3.7 10.21ZM16.75 10.16 17.78 10.16 18.46 10.97 19.17 10.16 20.21 10.21 18.5 12.09 16.75 10.21ZM11.96 10.83 12.49 10.92 13.08 11.28 13.48 11.91 13.61 12.45 13.61 12.67 13.21 12.67 13.12 13.17 12.85 13.61 12.09 14.02 11.33 13.79 11.01 13.48 10.74 12.67 10.39 12.67 10.43 12.09 10.74 11.46 11.46 10.92 11.96 10.88ZM11.78 11.33 11.33 11.51 11.01 11.82 10.79 12.63 13.17 12.63 13.12 12.13 12.76 11.6 12.27 11.33 11.82 11.33ZM6.22 13.03 7.34 13.03 11.96 18.19 16.62 13.03 17.78 13.08 12.04 19.44 11.6 19.09 6.22 13.08ZM8.41 13.03 9.71 13.03 9.85 13.61 10.25 14.33 10.92 14.91 11.73 15.18 12.49 15.14 13.43 14.65 13.88 14.11 14.24 13.03 15.59 13.08 12.04 17.02 11.73 16.8 8.41 13.08ZM3.7 13.21 5.59 13.21 11.78 20.03 11.78 20.16 10.12 22.0 9.89 22.0 9.76 21.87 4.38 15.86 3.84 15.86 3.84 19.17 3.17 19.17 3.17 13.66 3.26 13.66 9.89 21.1 10.34 20.65 10.21 20.39 3.7 13.26ZM18.37 13.21 20.25 13.26 13.61 20.65 14.06 21.1 20.74 13.66 20.83 13.66 20.83 19.17 20.16 19.17 20.16 15.9 19.58 15.86 14.38 21.69 14.06 22.0 13.88 22.0 12.18 20.07 18.37 13.26ZM11.96 20.79 13.03 21.96 12.63 21.96 12.36 21.55 11.82 21.46 11.55 21.6 11.33 21.96 10.92 22.0 11.96 20.83Z" />
    </svg>
  );
}

export function IconVarzia({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="3" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <path d="M12 7v2.2M12 14.8V17M7 12h2.2M14.8 12H17" />
    </svg>
  );
}
export function IconInventory({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16V8Z" />
      <path d="M3.5 8 12 12.5 20.5 8M12 12.5v8" />
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
