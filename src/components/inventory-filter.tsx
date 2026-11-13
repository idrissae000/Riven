import { INV_SORTS, type InvSort } from "@/lib/inventory/browse";

/** Search box + sort dropdown for an inventory list (A→Z / Z→A / price / stack value / quantity). */
export function InventoryFilter({ q, onQ, sort, onSort, shown, total }: { q: string; onQ: (v: string) => void; sort: InvSort; onSort: (v: InvSort) => void; shown: number; total: number }) {
  return (
    <div className="space-y-1.5">
      <div className="grid gap-2 sm:grid-cols-[1fr_16rem]">
        <input className="input" type="search" placeholder="Search your items…" value={q} onChange={(e) => onQ(e.target.value)} aria-label="Search items" />
        <select className="input" value={sort} onChange={(e) => onSort(e.target.value as InvSort)} aria-label="Sort by">{INV_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
      </div>
      {(q.trim() || shown !== total) && <p className="text-xs text-dim">Showing {shown} of {total}</p>}
    </div>
  );
}
