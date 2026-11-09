import { describe, expect, it } from "vitest";
import { buildCreateAuction, wfmRivenName } from "./auction-payload";

const riven = {
  weapon_slug: "soma", riven_name: "Crita-cron", rank: 8, rerolls: 4, polarity: "madurai" as const, mastery_rank: 11,
  stats: [
    { stat: "critical_chance", value: 150.2, is_negative: false },
    { stat: "recoil", value: -40, is_negative: false },
    { stat: "zoom", value: -30, is_negative: true },
  ],
};

describe("buildCreateAuction", () => {
  it("builds a direct-sell riven auction with roles (not signs) in `positive`", () => {
    const r = buildCreateAuction(riven, { price: 450, note: "gl" });
    if ("error" in r) throw new Error(r.error);
    expect(r.body).toMatchObject({ starting_price: 450, buyout_price: 450, visible: true, private: false, note: "gl" });
    expect(r.body.item).toMatchObject({ type: "riven", weapon_url_name: "soma", name: "crita-cron", mod_rank: 8, re_rolls: 4, polarity: "madurai", mastery_level: 11 });
    expect(r.body.item.attributes).toEqual([
      { positive: true, url_name: "critical_chance", value: 150.2 },
      { positive: true, url_name: "recoil", value: -40 },
      { positive: false, url_name: "zoom", value: -30 },
    ]);
  });
  it("requires a riven name and a sane whole-number price", () => {
    expect("error" in buildCreateAuction({ ...riven, riven_name: null }, { price: 10 })).toBe(true);
    expect("error" in buildCreateAuction(riven, { price: 0 })).toBe(true);
    expect("error" in buildCreateAuction(riven, { price: 10.5 })).toBe(true);
  });
  it("normalises names", () => expect(wfmRivenName(" Crita-Cron! ")).toBe("crita-cron"));
});
