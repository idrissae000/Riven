"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** What you paid per unit for a holding: click to type it in, blank to clear. */
export function CostCell({ id, cost }: { id: string; cost: number | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(cost == null ? "" : String(cost));
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const res = await fetch(`/api/inventory/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cost_each: v.trim() === "" ? null : Number(v) }) });
    setBusy(false);
    if (res.ok) { setEditing(false); router.refresh(); }
  }
  if (!editing) return <button className="text-xs text-dim underline-offset-2 hover:text-gold hover:underline" onClick={() => setEditing(true)} aria-label="Set what you paid">{cost == null ? "add" : `${cost}p`}</button>;
  return (
    <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <input className="input !min-h-8 w-16 !px-2 !py-1 text-xs" type="number" min={0} autoFocus value={v} onChange={(e) => setV(e.target.value)} aria-label="Platinum paid each" />
      <button className="btn-primary !min-h-8 px-2 text-xs" disabled={busy}>Save</button>
    </form>
  );
}
