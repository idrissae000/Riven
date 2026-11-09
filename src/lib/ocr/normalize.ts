import type { ScannedRiven, ScannedStat } from "./map";

/**
 * Turns whatever the model returned into a safe ScannedRiven. Deliberately forgiving: a scan should
 * degrade to "some fields filled, rest left for the user" rather than fail on one odd value.
 */
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function int(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= min && r <= max ? r : null; // out of range (including the -1 "unknown" sentinel) -> null
}

/** "+112.3%", "−30.5%" (unicode minus), "x1.54", 112 -> number (signed). */
export function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const t = v.replace(/[−–—]/g, "-").replace(/,/g, ".");
  const m = /-?\s*\d+(?:\.\d+)?/.exec(t);
  return m ? parseFloat(m[0].replace(/\s+/g, "")) : null;
}

const POLARITY: Record<string, ScannedRiven["polarity"]> = {
  madurai: "madurai", v: "madurai", vazarin: "vazarin", d: "vazarin", naramon: "naramon", "-": "naramon", dash: "naramon", "–": "naramon",
};

export function normalizeScan(raw: unknown): ScannedRiven {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const stats: ScannedStat[] = [];
  for (const s of Array.isArray(o.stats) ? o.stats : []) {
    const r = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
    const name = str(r.name);
    const shown = str(r.shown) ?? (typeof r.value === "number" ? String(r.value) : "");
    let value = parseNumber(r.value) ?? parseNumber(shown);
    if (!name || value == null) continue;
    // The printed text is the source of truth for the sign.
    if (/^[\s(]*[-−–]/.test(shown) && value > 0) value = -value;
    stats.push({ name, value, shown: shown || String(value), is_curse: r.is_curse === true });
  }
  stats.splice(4); // a riven has at most 4 stats
  // At most one curse: if the model flagged several, keep only the last (the card lists it last).
  const curses = stats.filter((s) => s.is_curse);
  if (curses.length > 1) curses.slice(0, -1).forEach((s) => (s.is_curse = false));

  return {
    weapon_name: str(o.weapon_name),
    riven_name: str(o.riven_name),
    polarity: POLARITY[String(o.polarity ?? "").trim().toLowerCase()] ?? null,
    mastery_rank: int(o.mastery_rank, 8, 16),
    rank: int(o.rank, 0, 8),
    rerolls: int(o.rerolls, 0, 999),
    stats,
    notes: str(o.notes),
  };
}

/** Pulls the first JSON object out of free text (handles ```json fences and chatter around it). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON in the model's reply.");
  return JSON.parse(body.slice(start, end + 1));
}
