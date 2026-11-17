import Link from "next/link";

/** Checking a riven, the rivens you saved (where you list them), and the weapon price ranking. */
export function RivensTabs({ active }: { active: "check" | "weapons" }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? "page" : undefined}
      className={`border-b-2 px-3 py-2 font-display text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${on ? "border-gold text-gold" : "border-transparent text-dim hover:text-ink"}`}>
      {label}
    </Link>
  );
  return <nav className="flex flex-wrap gap-1 border-b border-line" aria-label="Riven sections">{tab("/rivens/new", "Check a riven", active === "check")}{tab("/inventory/rivens", "My rivens & listing", false)}{tab("/rivens/weapons", "Weapon ranking", active === "weapons")}</nav>;
}
