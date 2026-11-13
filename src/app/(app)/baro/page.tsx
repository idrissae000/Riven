import Link from "next/link";
import { BaroPicks, type BaroRow } from "@/components/baro-picks";
import type { SalesDay } from "@/lib/history-sales";
import { Countdown } from "@/components/countdown";
import { PageHeader } from "@/components/page-header";
import { PriceRefresher } from "@/components/price-refresher";
import { baroDue } from "@/lib/baro/due";
import { createClient } from "@/lib/supabase/server";
import { getWorldState } from "@/lib/worldstate";
import type { Confidence } from "@/lib/baro/analysis";

export const metadata = { title: "Baro Ki’Teer picks" };

export default async function BaroPage() {
  const { state } = await getWorldState();
  const baro = state?.baro ?? null;
  const here = !!baro && baro.items.length > 0;

  let rows: BaroRow[] = [];
  let due = 0;
  const history: Record<string, SalesDay[]> = {};
  if (baro && here) {
    const sb = await createClient();
    const { data } = await sb.from("baro_items").select("name,ducats,credits,wfm_slug,price_now,pre_price,listings,ratio_short,ratio_long,dip_share,cycles,confidence,computed_at").eq("visit", new Date(baro.arrives).toISOString());
    const stored = new Map(((data ?? []) as Record<string, unknown>[]).map((r) => [r.name as string, r]));
    const num = (v: unknown) => (v == null ? null : Number(v));
    rows = baro.items.map((i): BaroRow => {
      const r = stored.get(i.item);
      return {
        name: i.item, ducats: i.ducats, credits: i.credits, slug: (r?.wfm_slug as string | null | undefined) ?? null,
        priceNow: num(r?.price_now), pre: num(r?.pre_price), listings: Number(r?.listings ?? 0), ratioShort: num(r?.ratio_short), ratioLong: num(r?.ratio_long), dipShare: num(r?.dip_share),
        cycles: Number(r?.cycles ?? 0), confidence: ((r?.confidence as Confidence | undefined) ?? "none"), ready: !!r?.computed_at,
      };
    });
    // 100 days of daily sales for each tradable item (the table + chart in the details)
    const slugs = rows.flatMap((r) => (r.slug ? [r.slug] : []));
    if (slugs.length) {
      const since = new Date(Date.parse(baro.arrives) - 100 * 86_400_000).toISOString().slice(0, 10);
      const { data: sales } = await sb.from("sales_history").select("slug,day,avg_price,min_price,max_price,volume").in("slug", slugs).gte("day", since).order("day").limit(5000);
      for (const s of (sales ?? []) as Record<string, unknown>[]) (history[s.slug as string] ??= []).push({ day: s.day as string, avg: Number(s.avg_price), min: s.min_price == null ? null : Number(s.min_price), max: s.max_price == null ? null : Number(s.max_price), volume: Number(s.volume ?? 0) });
    }
    due = baroDue(baro.items, ((data ?? []) as { name: string; wfm_slug: string | null; computed_at: string | null }[]));
  }

  return (
    <div className="space-y-5">
      <PageHeader kicker="Void Trader" title="Baro Ki’Teer">
        <Link href="/live" className="btn">Live world state</Link>
      </PageHeader>
      {!baro ? (
        <p className="card text-sm text-dim">Couldn’t load Baro’s status from the world-state feed right now. Try again in a minute.</p>
      ) : !here ? (
        <div className="card space-y-1 text-sm">
          <p className="text-ink">Baro isn’t here yet{baro.location ? ` — he’ll be at ${baro.location}` : ""}.</p>
          <p className="text-dim">Arrives in <Countdown to={baro.arrives} />. His stock and our recommendations appear here the moment he lands.</p>
        </div>
      ) : (
        <>
          <section className="card flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm"><b>{baro.location}</b> <span className="text-dim">· leaves in <Countdown to={baro.leaves} /></span></p>
            <p className="text-xs text-dim">{rows.length} items · {rows.filter((r) => r.slug).length} tradable</p>
          </section>
          <PriceRefresher due={due} endpoint="/api/baro/refresh" />
          <BaroPicks rows={rows} history={history} arrival={baro.arrives} />
        </>
      )}
    </div>
  );
}
