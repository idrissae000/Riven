import Link from "next/link";

/** Switches between the Prime parts list, the relic ranking and the inventory scanner. */
export function PrimesTabs({ active }: { active: "parts" | "relics" | "scan" }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? "page" : undefined}
      className={`border-b-2 px-3 py-2 font-display text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${on ? "border-gold text-gold" : "border-transparent text-dim hover:text-ink"}`}>
      {label}
    </Link>
  );
  return <nav className="flex gap-1 border-b border-line" aria-label="Prime sections">{tab("/primes", "Most expensive parts", active === "parts")}{tab("/primes/relics", "Best relics", active === "relics")}{tab("/primes/scan", "Scan inventory", active === "scan")}</nav>;
}
