import type { Riven } from "@/lib/types";

/** Body for POST /v1/auctions/create (riven, direct-sell / buy-it-now). */
export interface CreateAuctionBody {
  note: string;
  starting_price: number;
  buyout_price: number;
  minimal_reputation: number;
  minimal_increment: number;
  private: boolean;
  visible: boolean;
  item: {
    type: "riven";
    weapon_url_name: string;
    name: string;
    mod_rank: number;
    re_rolls: number;
    polarity: string;
    mastery_level: number;
    attributes: { positive: boolean; url_name: string; value: number }[];
  };
}

/** Riven name as WFM expects it: lowercase letters and hyphens, e.g. "Crita-cron" -> "crita-cron". */
export function wfmRivenName(name: string | null | undefined): string {
  return (name ?? "").toLowerCase().replace(/[^a-z-]/g, "").replace(/^-+|-+$/g, "");
}

export function buildCreateAuction(
  riven: Pick<Riven, "weapon_slug" | "riven_name" | "rank" | "rerolls" | "polarity" | "mastery_rank" | "stats">,
  opts: { price: number; note?: string },
): { body: CreateAuctionBody } | { error: string } {
  const name = wfmRivenName(riven.riven_name);
  if (!name) return { error: "Add the riven’s name (e.g. “Crita-cron”) before listing it — Warframe Market requires it." };
  if (!Number.isInteger(opts.price) || opts.price < 1 || opts.price > 99_999_999) return { error: "Price must be a whole number of platinum (1 or more)." };
  if (riven.stats.length < 2) return { error: "A riven needs at least 2 stats." };
  return {
    body: {
      note: (opts.note ?? "").slice(0, 100),
      starting_price: opts.price,
      buyout_price: opts.price,
      minimal_reputation: 0,
      minimal_increment: 1,
      private: false,
      visible: true,
      item: {
        type: "riven",
        weapon_url_name: riven.weapon_slug,
        name,
        mod_rank: riven.rank,
        re_rolls: riven.rerolls,
        polarity: riven.polarity,
        mastery_level: riven.mastery_rank,
        // `positive` is the ROLE (bonus vs curse), not the sign — a Recoil bonus is negative and positive:true.
        attributes: riven.stats.map((s) => ({ positive: !s.is_negative, url_name: s.stat, value: s.value })),
      },
    },
  };
}
