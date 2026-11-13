import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { detectSales, type OrderSnap } from "@/lib/sales/detect";
import { ReauthRequired, sessionInfo, wfmConfigured } from "@/lib/wfm/auth";
import { fetchMyOrders } from "@/lib/wfm/my-orders";

export const maxDuration = 60;

/**
 * Looks at the user's current sell orders and compares them with the last look: orders that vanished or shrank are recorded as PENDING
 * sales for the user to confirm (they could also have removed or lowered the order themselves). The first look only records a baseline.
 */
export async function POST() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (!wfmConfigured()) return NextResponse.json({ skipped: "not-configured", pending: 0 });
  const info = await sessionInfo(auth.user.id);
  if (!info.connected) return NextResponse.json({ skipped: "not-connected", pending: 0 });

  try {
    const got = await fetchMyOrders(auth.user.id);
    if ("status" in got) return NextResponse.json({ skipped: "wfm-error", pending: 0 });
    const now: OrderSnap[] = got.orders.filter((o) => o.type === "sell").map((o) => ({ orderId: o.id, slug: o.item.slug, name: o.item.name, rank: o.rank, qty: o.quantity, price: o.platinum }));

    const { data: prevRows } = await auth.sb.from("order_snapshots").select("order_id,slug,name,rank,qty,price");
    const prev: OrderSnap[] = (prevRows ?? []).map((r) => ({ orderId: r.order_id as string, slug: r.slug as string, name: r.name as string, rank: Number(r.rank), qty: Number(r.qty), price: Number(r.price) }));

    let pending = 0;
    if (prev.length) {
      const found = detectSales(prev, now);
      if (found.length) {
        const { error } = await auth.sb.from("sales_log").insert(found.map((f) => ({ user_id: auth.user.id, item_name: f.name, slug: f.slug, qty: f.qty, price_each: f.priceEach, source: "detected", status: "pending" })));
        if (!error) pending = found.length;
      }
    }

    // refresh the baseline: current orders in, vanished ones out
    const gone = prev.filter((p) => !now.some((n) => n.orderId === p.orderId)).map((p) => p.orderId);
    if (gone.length) await auth.sb.from("order_snapshots").delete().in("order_id", gone);
    if (now.length) await auth.sb.from("order_snapshots").upsert(now.map((n) => ({ user_id: auth.user.id, order_id: n.orderId, slug: n.slug, name: n.name, rank: n.rank, qty: n.qty, price: n.price, seen_at: new Date().toISOString() })), { onConflict: "user_id,order_id" });

    const { count } = await auth.sb.from("sales_log").select("id", { count: "exact", head: true }).eq("status", "pending");
    return NextResponse.json({ pending: count ?? pending, baseline: prev.length === 0 });
  } catch (e) {
    if (e instanceof ReauthRequired) return NextResponse.json({ skipped: "reauth", pending: 0 });
    return NextResponse.json({ skipped: "error", pending: 0 });
  }
}
