import "server-only";
import { ALLOWED_TYPES, ScanFailed, askJson, makeClient, toBlock, type AllowedType } from "@/lib/ocr/extract";
import { extractJson } from "@/lib/ocr/normalize";
import type { ReadItem } from "./scan-match";

export { ALLOWED_TYPES, type AllowedType };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items", "notes"],
  properties: {
    items: {
      type: "array",
      description: "One entry per distinct item visible, in reading order.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "qty"],
        properties: {
          name: { type: "string", description: "The full item name exactly as printed, e.g. 'Frost Prime Chassis Blueprint' or 'Lex Prime Barrel'." },
          qty: { type: "integer", description: "The stack count shown on that item (the number in a corner, or 'x3'). 1 if no number is shown." },
        },
      },
    },
    notes: { type: "string", description: "Anything cut off, blurry or uncertain. Empty string if all was clear." },
  },
} as const;

const PROMPT = `This is a screenshot (or phone photo of a screen) of a Warframe inventory screen showing Prime parts, blueprints or sets (for example the Foundry/inventory grid, the Prime Access / Baro Ki'Teer ducat screen, or a trade list).

List every distinct item you can read. For each give the full name exactly as printed and its stack count. Rules:
- Names usually look like "<Warframe/Weapon> Prime <Part>" (Chassis Blueprint, Neuroptics Blueprint, Systems Blueprint, Barrel, Receiver, Stock, Blade, Handle, Link, String, Grip, Lower Limb, Upper Limb, Blueprint, Cerebrum, Carapace…), or "<Name> Prime Set". Include the whole name; never shorten it, never invent a part you can't read.
- The stack count is a small number in a corner of each tile (sometimes shown as "x3" or "3"). If a tile shows no number, use 1.
- Ignore everything that isn't a Prime part/blueprint/set (mods, resources, relics, UI text, platinum or ducat totals).
- If a tile is cut off at the screen edge or unreadable, skip it and say so in "notes".
- If this is not an inventory screen at all, return no items and explain in "notes".`;

const PLAIN = `\n\nReply with ONLY a JSON object, no prose: {"items": [{"name": string, "qty": integer}], "notes": string}.`;

const REWARDS_PROMPT = `This is a screenshot (or phone photo) of a Warframe MISSION REWARDS screen — for example the end of a Void Cascade, a relic fissure run, or any mission-complete reward screen.

List every Prime part, blueprint or set that was awarded. Rules:
- Use the full name exactly as printed, e.g. "Frost Prime Chassis Blueprint" or "Lex Prime Barrel". Never shorten a name or invent one you can't read.
- Each reward tile is one item: use qty 1 unless a count such as "x2" is shown on it.
- Ignore everything that isn't a Prime part/blueprint/set: relics, Forma, Endo, Ayatan stars, credits, mods, resources, platinum, UI text.
- If rewards for several squad members are shown, list all of them and say so in "notes" (the player will remove any that aren't theirs).
- If a tile is cut off or unreadable, skip it and say so in "notes". If this is not a rewards screen, return no items and explain in "notes".`;

const ARCANE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items", "notes"],
  properties: {
    items: {
      type: "array",
      description: "One entry per distinct arcane visible, in reading order.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "qty", "rank"],
        properties: {
          name: { type: "string", description: "The arcane's full name exactly as printed, e.g. 'Arcane Energize' or 'Magus Lockdown'." },
          qty: { type: "integer", description: "The stack count shown on that tile ('x3' or a number in a corner). 1 if no number is shown." },
          rank: { type: "integer", description: "The arcane's rank if the tile shows one (e.g. 'Rank 3/5' or a rank pip count). 0 if unranked or no rank is shown." },
        },
      },
    },
    notes: { type: "string", description: "Anything cut off, blurry or uncertain. Empty string if all was clear." },
  },
} as const;

const ARCANE_PROMPT = `This is a screenshot (or phone photo of a screen) of a Warframe inventory screen showing ARCANES (the Arcane section of the inventory or a trade list).

List every distinct arcane you can read. For each give the full name exactly as printed, its stack count and its rank. Rules:
- Arcane names look like "Arcane Energize", "Magus Lockdown", "Virtuos Strike", "Residual Malodor", "Exodia Brave", "Primary Merciless". Never shorten a name and never invent one you can't read.
- The stack count is a small number on the tile (sometimes "x3"). If none is shown, use 1.
- The rank is shown as "Rank N/M" or as filled rank pips. Report N. If the arcane is unranked or no rank is visible, use 0.
- Ignore everything that isn't an arcane (mods, resources, Vosfor, relics, UI text).
- If a tile is cut off or unreadable, skip it and say so in "notes". If this is not an arcane inventory screen, return no items and explain in "notes".`;

const ARCANE_REWARDS_PROMPT = `This is a screenshot (or phone photo) of a Warframe REWARDS screen that shows ARCANES — for example arcane rewards from a mission, an event or a Vosfor/Cache reveal.

List every arcane that was awarded. Rules:
- Use the full name exactly as printed, e.g. "Arcane Energize" or "Magus Lockdown". Never shorten a name or invent one you can't read.
- Each reward tile is one arcane: qty 1 unless a count such as "x2" is shown. Newly earned arcanes are unranked: rank 0 unless a rank is shown.
- Ignore everything that isn't an arcane. If rewards for several squad members are shown, list all of them and say so in "notes".
- If a tile is cut off or unreadable, skip it and say so in "notes". If this is not a rewards screen, return no items and explain in "notes".`;

const ARCANE_PLAIN = `\n\nReply with ONLY a JSON object, no prose: {"items": [{"name": string, "qty": integer, "rank": integer}], "notes": string}.`;

/**
 * Reads the item names + counts (+ ranks for arcanes) off one screenshot (a Claude vision call). "rewards" reads a rewards
 * screen; "inventory" an inventory/trade grid. `kind` says whether it is Prime parts or arcanes.
 */
export async function readInventoryImage(bytes: Buffer, mediaType: AllowedType, mode: "inventory" | "rewards" = "inventory", kind: "prime" | "arcane" = "prime"): Promise<{ items: ReadItem[]; notes: string }> {
  const arcane = kind === "arcane";
  const prompt = arcane ? (mode === "rewards" ? ARCANE_REWARDS_PROMPT : ARCANE_PROMPT) : mode === "rewards" ? REWARDS_PROMPT : PROMPT;
  const raw = (await askJson(makeClient(), toBlock(bytes, mediaType), prompt, arcane ? ARCANE_SCHEMA : SCHEMA, arcane ? ARCANE_PLAIN : PLAIN, 12000)) as { items?: unknown; notes?: unknown };
  const obj = typeof raw === "string" ? (extractJson(raw) as typeof raw) : raw;
  if (!obj || !Array.isArray(obj.items)) throw new ScanFailed(`Couldn’t read any items from that image. Try a sharper, straight-on screenshot of your ${arcane ? "arcanes" : "inventory"}.`);
  const items = obj.items.flatMap((i): ReadItem[] => {
    const it = i as { name?: unknown; qty?: unknown; rank?: unknown };
    const name = typeof it.name === "string" ? it.name.trim() : "";
    const qty = typeof it.qty === "number" ? it.qty : parseInt(String(it.qty ?? ""), 10);
    const rank = typeof it.rank === "number" ? it.rank : parseInt(String(it.rank ?? ""), 10);
    return name ? [{ name: name.slice(0, 120), qty: Number.isFinite(qty) && qty >= 1 ? Math.min(9999, qty) : 1, ...(arcane ? { rank: Number.isFinite(rank) && rank > 0 ? rank : 0 } : {}) }] : [];
  });
  return { items: items.slice(0, 400), notes: typeof obj.notes === "string" ? obj.notes : "" };
}
