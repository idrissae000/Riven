import Link from "next/link";
import { InventoryTabs } from "@/components/inventory-tabs";
import { PageHeader } from "@/components/page-header";
import { SalesTracker, type SaleItem } from "@/components/sales-tracker";
import { currentUserId, listArcanes } from "@/lib/data";
import { primeCatalogue } from "@/lib/primes/catalogue";
import { createClient } from "@/lib/supabase/server";
import { sessionInfo, wfmConfigured } from "@/lib/wfm/auth";

export const metadata = { title: "Sales" };

export default async function SalesPage() {
  const uid = await currentUserId();
  if (!uid) {
    return (
      <div className="space-y-5">
        <PageHeader kicker="Your stuff" title="Inventory" />
        <InventoryTabs active="sales" />
        <div className="card space-y-3 text-sm text-dim">
          <p>Track what you sell and how much platinum you make each week. Sales are saved to your Warframe Economist account.</p>
          <Link href="/login?next=/inventory/sales" className="btn-primary">Sign in</Link>
        </div>
      </div>
    );
  }
  const sb = await createClient();
  const [{ data }, arcanes, session] = await Promise.all([
    sb.from("sales_log").select("id,item_name,qty,price_each,sold_at,source,status").neq("status", "dismissed").order("sold_at", { ascending: false }).limit(1000),
    listArcanes(),
    wfmConfigured() ? sessionInfo(uid) : Promise.resolve({ connected: false }),
  ]);
  const sales = ((data ?? []) as Record<string, unknown>[]).map((r): SaleItem => ({ id: r.id as string, item_name: r.item_name as string, qty: Number(r.qty), price_each: Number(r.price_each), sold_at: r.sold_at as string, source: r.source as string, status: r.status as string }));
  const names = [...primeCatalogue.parts.map((p) => p.name), ...arcanes.map((a) => a.name)];
  return (
    <div className="space-y-5">
      <PageHeader kicker="Your stuff" title="Inventory" />
      <InventoryTabs active="sales" />
      <SalesTracker sales={sales} itemNames={names} now={new Date().getTime()} connected={session.connected} />
    </div>
  );
}
