export type InvSort = "price" | "total" | "az" | "za" | "qty";

export const INV_SORTS: { value: InvSort; label: string }[] = [
  { value: "price", label: "Price each: high to low" },
  { value: "total", label: "Stack value: high to low" },
  { value: "az", label: "Name: A → Z" },
  { value: "za", label: "Name: Z → A" },
  { value: "qty", label: "Quantity: most first" },
];

interface Browsable { name: string; qty: number; unit?: number | null; total?: number | null }

/** Filters by a name search (every word must appear, any order) and sorts. Unpriced items go last when sorting by price. */
export function browseRows<T extends Browsable>(rows: T[], query: string, sort: InvSort): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const num = (v: number | null | undefined) => (v == null ? -Infinity : v);
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const cmp: Record<InvSort, (a: T, b: T) => number> = {
    price: (a, b) => num(b.unit) - num(a.unit) || byName(a, b),
    total: (a, b) => num(b.total) - num(a.total) || byName(a, b),
    az: byName,
    za: (a, b) => byName(b, a),
    qty: (a, b) => b.qty - a.qty || byName(a, b),
  };
  return rows.filter((r) => { const n = r.name.toLowerCase(); return words.every((w) => n.includes(w)); }).sort(cmp[sort]);
}
