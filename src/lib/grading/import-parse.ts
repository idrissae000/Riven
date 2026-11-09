/**
 * Parses a grading-range dataset (JSON or CSV) into rows for riven_grade_ranges.
 * Pure + dependency-free so it's unit-tested and shared by the import script.
 *
 * JSON: [{weapon, stat, min, max, is_negative?}] or {ranges: [...], is_placeholder?, source?}
 * CSV : header row with weapon,stat,min,max[,is_negative]   (min_roll/max_roll also accepted)
 *   weapon = WFM slug (e.g. "soma") or "*" for a default row used by every weapon.
 *   stat   = riven attribute slug (e.g. "critical_damage"); see data/generated/riven_attributes.json
 *   min/max = SIGNED, as displayed in game at MAX rank (rank 8); min <= max.
 */
export interface ParsedRange {
  weapon_slug: string;
  stat_slug: string;
  is_negative: boolean;
  min_roll: number;
  max_roll: number;
}
export interface ParsedDataset {
  rows: ParsedRange[];
  errors: string[];
  is_placeholder: boolean | null;
  source: string | null;
}

const truthy = (v: unknown) => v === true || /^(true|1|yes|y)$/i.test(String(v ?? "").trim());

function normalise(raw: Record<string, unknown>, where: string, errors: string[]): ParsedRange | null {
  const weapon = String(raw.weapon ?? raw.weapon_slug ?? "").trim().toLowerCase();
  const stat = String(raw.stat ?? raw.stat_slug ?? "").trim();
  const min = Number(raw.min ?? raw.min_roll);
  const max = Number(raw.max ?? raw.max_roll);
  if (!weapon || !stat) { errors.push(`${where}: weapon and stat are required`); return null; }
  if (!Number.isFinite(min) || !Number.isFinite(max)) { errors.push(`${where}: min/max must be numbers`); return null; }
  if (min > max) { errors.push(`${where}: min (${min}) is greater than max (${max}) for ${weapon}/${stat}`); return null; }
  return { weapon_slug: weapon, stat_slug: stat, is_negative: truthy(raw.is_negative), min_roll: min, max_roll: max };
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length === 0) return [];
  const split = (l: string) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const header = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((c, i) => [header[i], c])));
}

export function parseDataset(text: string, filename: string): ParsedDataset {
  const errors: string[] = [];
  let records: Record<string, unknown>[];
  let is_placeholder: boolean | null = null;
  let source: string | null = null;

  if (filename.toLowerCase().endsWith(".csv")) {
    records = parseCsv(text);
  } else {
    let json: unknown;
    try { json = JSON.parse(text); } catch (e) { return { rows: [], errors: [`Invalid JSON: ${(e as Error).message}`], is_placeholder, source }; }
    if (Array.isArray(json)) records = json;
    else if (json && typeof json === "object" && Array.isArray((json as { ranges?: unknown }).ranges)) {
      const o = json as { ranges: Record<string, unknown>[]; is_placeholder?: boolean; source?: string };
      records = o.ranges;
      is_placeholder = typeof o.is_placeholder === "boolean" ? o.is_placeholder : null;
      source = o.source ?? null;
    } else return { rows: [], errors: ["Expected an array or an object with a `ranges` array"], is_placeholder, source };
  }

  const rows: ParsedRange[] = [];
  const seen = new Set<string>();
  records.forEach((r, i) => {
    const row = normalise(r, `row ${i + 1}`, errors);
    if (!row) return;
    const key = `${row.weapon_slug}|${row.stat_slug}|${row.is_negative}`;
    if (seen.has(key)) { errors.push(`row ${i + 1}: duplicate ${row.weapon_slug}/${row.stat_slug}${row.is_negative ? " (negative)" : ""}`); return; }
    seen.add(key);
    rows.push(row);
  });
  return { rows, errors, is_placeholder, source };
}
