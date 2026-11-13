import Link from "next/link";
import { BaroPicks, type BaroRow } from "@/components/baro-picks";
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
  if (baro && here) {
    const sb = await createClient();
    const { data } = await sb.from("baro_items").select("name,ducats,credits,wfm_slug,price_now,listings,ratio_short,ratio_long,dip_share,cycles,confidence,computed_at").eq("visit", new Date(baro.arrives).toISOString());
    const stored = new Map(((data ?? []) as Record<string, unknown>[]).map((r) => [r.name as string, r]));
    const num = (v: unknown) => (v == null ? null : Number(v));
    rows = baro.items.map((i): BaroRow => {
      const r = stored.get(i.item);
      return {
        name: i.item, ducats: i.ducats, credits: i.credits, slug: (r?.wfm_slug as string | null | undefined) ?? null,
        priceNow: num(r?.price_now), listings: Number(r?.listings ?? 0), ratioShort: num(r?.ratio_short), ratioLong: num(r?.ratio_long), dipShare: num(r?.dip_share),
        cycles: Number(r?.cycles ?? 0), confidence: ((r?.confidence as Confidence | undefined) ?? "none"), ready: !!r?.computed_at,
      };
    });
    due = baroDue(baro.items, ((data ?? []) as { name: string; wfm_slug: string | null; computed_at: string | null }[]));
  }

  return (
    <div className="space-y-5">
      <PageHeader kicker="Void Trader" title="Baro Ki’Teer picks">
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
          <BaroPicks rows={rows} />
        </>
      )}
    </div>
  );
}
