import Link from "next/link";

/** Switches between the Prime parts list and the relic ranking. */
export function PrimesTabs({ active }: { active: "parts" | "relics" }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? "page" : undefined}
      className={`border-b-2 px-3 py-2 font-display text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${on ? "border-gold text-gold" : "border-transparent text-dim hover:text-ink"}`}>
      {label}
    </Link>
  );
  return <nav className="flex gap-1 border-b border-line" aria-label="Prime sections">{tab("/primes", "Most expensive parts", active === "parts")}{tab("/primes/relics", "Best relics", active === "relics")}</nav>;
}
