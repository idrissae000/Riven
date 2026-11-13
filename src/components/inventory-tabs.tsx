import Link from "next/link";

/** Switches between the saved Prime parts / arcanes, the screenshot scanner the user's rivens and their live Warframe Market listings. */
export function InventoryTabs({ active }: { active: "items" | "scan" | "rivens" | "listings" | "sales" }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? "page" : undefined}
      className={`border-b-2 px-3 py-2 font-display text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${on ? "border-gold text-gold" : "border-transparent text-dim hover:text-ink"}`}>
      {label}
    </Link>
  );
  return <nav className="flex flex-wrap gap-1 border-b border-line" aria-label="Inventory sections">{tab("/inventory", "Prime parts & arcanes", active === "items")}{tab("/inventory/scan", "Scan screenshots", active === "scan")}{tab("/inventory/rivens", "Rivens", active === "rivens")}{tab("/inventory/listings", "My listings", active === "listings")}{tab("/inventory/sales", "Sales", active === "sales")}</nav>;
}
