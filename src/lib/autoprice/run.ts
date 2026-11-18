import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ReauthRequired, sessionInfo, wfmAuthedV2 } from "@/lib/wfm/auth";
import { wfmRequest } from "@/lib/wfm/client";
import { cheapestOnline, type Listing, type RawOrder } from "@/lib/wfm/listings";
import { fetchMyOrders } from "@/lib/wfm/my-orders";
import { readStatus } from "@/lib/wfm/status";
import { planAutoprice, type AutoSettings } from "./plan";

/** How often a user is looked at. With the "online in game" requirement only active players cost anything: a not-in-game user costs one cheap call per check. */
export const RUN_INTERVAL_MS = 2 * 60_000;
const MAX_CHANGES = 15, MAX_MARKETS = 25;

export interface AutoRunResult { users: number; changed: number; errors: number }

/**
 * For each user who switched auto-repricing on (and whose last run was 10+ minutes ago), lowers sell orders that have been undercut,
 * within their floor and drop cap, and logs every change. `sb` must be a service-role client.
 */
export async function runAutoprice(sb: SupabaseClient, now = Date.now(), maxUsers = 5): Promise<AutoRunResult> {
  const out: AutoRunResult = { users: 0, changed: 0, errors: 0 };
  const due = new Date(now - RUN_INTERVAL_MS).toISOString();
  const { data } = await sb.from("autoprice_settings").select("user_id,rule,floor,max_drop_pct,follow_up").eq("enabled", true).or(`last_run_at.is.null,last_run_at.lt.${due}`).order("last_run_at", { ascending: true, nullsFirst: true }).limit(maxUsers);
  for (const row of (data ?? []) as { user_id: string; rule: AutoSettings["rule"]; floor: number; max_drop_pct: number; follow_up: boolean }[]) {
    out.users++;
    const uid = row.user_id;
    const setNote = (note: string | null, extra: Record<string, unknown> = {}) => sb.from("autoprice_settings").update({ last_run_at: new Date(now).toISOString(), note, ...extra }).eq("user_id", uid);
    await setNote(null); // claim this run first, so an overlapping run skips the user
    try {
      const me = await sessionInfo(uid);
      if (!me.connected) { await setNote("Auto-repricing is off: your Warframe Market session expired. Reconnect, then switch it on again.", { enabled: false }); continue; }
      // Only work while the user shows as ONLINE IN GAME on Warframe Market: it keeps this from hitting their account (and Warframe Market) around the clock.
      const status = await readStatus(uid);
      await sb.from("autoprice_settings").update({ status_seen: status, status_seen_at: new Date(now).toISOString() }).eq("user_id", uid);
      if (status !== "ingame") {
        await setNote(status == null ? "Paused: couldn’t read your Warframe Market status. It only runs while you show as online in game." : `Paused: you’re ${status === "invisible" ? "invisible" : status === "online" ? "online (not in game)" : "offline"} on Warframe Market. It only runs while you show as online in game.`);
        continue;
      }
      const mine = await fetchMyOrders(uid);
      if ("status" in mine) { await setNote(`Warframe Market answered ${mine.status}; will try again.`); out.errors++; continue; }
      const settings: AutoSettings = { rule: row.rule, floor: row.floor, maxDropPct: row.max_drop_pct, followUp: row.follow_up };
      const markets = new Map<string, Listing[]>();
      const sells = mine.orders.filter((o) => o.type === "sell" && o.visible).sort((a, b) => Date.parse(a.updatedAt ?? "0") - Date.parse(b.updatedAt ?? "0"));
      let changes = 0;
      for (const o of sells) {
        if (changes >= MAX_CHANGES) break;
        const key = `${o.item.slug}:${o.rank}`;
        let market = markets.get(key);
        if (!market) {
          if (markets.size >= MAX_MARKETS) continue;
          const res = await wfmRequest(`/v2/orders/item/${encodeURIComponent(o.item.slug)}`);
          if (!res.ok) continue;
          const json = (await res.json().catch(() => null)) as { data?: RawOrder[] } | null;
          market = cheapestOnline(Array.isArray(json?.data) ? json.data : [], 6, o.rank);
          markets.set(key, market);
        }
        const plan = planAutoprice(o, market, me.name, settings, now);
        if (plan.action !== "change") continue;
        const res = await wfmAuthedV2(uid, `/v2/order/${o.id}`, { method: "PATCH", body: JSON.stringify({ platinum: plan.to }) });
        if (!res.ok) { out.errors++; continue; }
        changes++; out.changed++;
        await sb.from("autoprice_log").insert({ user_id: uid, order_id: o.id, item_name: o.item.name, old_price: o.platinum, new_price: plan.to, cheapest: plan.cheapest, note: [plan.direction === "up" ? "raised to follow the cheapest" : null, plan.note].filter(Boolean).join(" · ") || null });
      }
    } catch (e) {
      out.errors++;
      if (e instanceof ReauthRequired) await setNote("Auto-repricing is off: Warframe Market didn’t accept your saved session. Reconnect, then switch it on again.", { enabled: false });
      else await setNote("Something went wrong reaching Warframe Market; will try again.");
    }
  }
  return out;
}
