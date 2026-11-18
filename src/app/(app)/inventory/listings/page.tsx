import Link from "next/link";
import { InventoryTabs } from "@/components/inventory-tabs";
import { StatusPanel } from "@/components/status-panel";
import { ListingsManager } from "@/components/listings-manager";
import { PageHeader } from "@/components/page-header";
import { AutoPricePanel, type AutoLogRow, type AutoSettingsRow } from "@/components/autoprice-panel";
import { currentUserId } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "My listings" };

export default async function ListingsPage() {
  const signedIn = !!(await currentUserId());
  let settings: AutoSettingsRow | null = null;
  let log: AutoLogRow[] = [];
  if (signedIn) {
    const sb = await createClient();
    const [{ data: s }, { data: l }] = await Promise.all([
      sb.from("autoprice_settings").select("enabled,rule,floor,max_drop_pct,follow_up,last_run_at,note,status_seen,status_seen_at").maybeSingle(),
      sb.from("autoprice_log").select("id,item_name,old_price,new_price,cheapest,note,at").order("at", { ascending: false }).limit(15),
    ]);
    settings = (s as AutoSettingsRow | null) ?? null;
    log = (l ?? []) as AutoLogRow[];
  }
  return (
    <div className="space-y-5">
      <PageHeader kicker="Your stuff" title="Inventory" />
      <InventoryTabs active="listings" />
      {signedIn ? <><StatusPanel /><ListingsManager /><AutoPricePanel settings={settings} log={log} /></> : (
        <div className="card space-y-3 text-sm text-dim">
          <p>See and manage everything you have listed on Warframe Market — reprice, hide or remove orders one at a time or in bulk. It needs a Warframe Economist account, because your Warframe Market connection is stored against it.</p>
          <Link href="/login?next=/inventory/listings" className="btn-primary">Sign in</Link>
        </div>
      )}
    </div>
  );
}
