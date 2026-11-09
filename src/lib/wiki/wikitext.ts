/** Wikitext helpers for turning wiki.warframe.com page source into clean, structured text. */

const TEMPLATE = /\{\{([^{}|]*)((?:\|[^{}]*)?)\}\}/;

const args = (rest: string) => rest.split("|").slice(1).map((a) => a.trim());

/** Resolves ONE innermost template call to plain text. */
function renderTemplate(name: string, rest: string, pagename: string): string {
  const n = name.trim().toLowerCase();
  const a = args(rest).filter((x) => !/^\w+\s*=/.test(x)); // drop named params like header=no
  switch (n) {
    case "sc": case "cc": return a[0] ? `${a[0]} Credits` : "Credits";
    case "ver": return a[0] ? `Update ${a[0]}` : "";
    case "pagename": return pagename;
    case "a": return a[1] ?? a[0] ?? ""; // {{A|Quiver|Dashwire Arrow}} -> display text
    case "sic": case "arcanebox": case "arcanenav": case "main": case "see also": return "";
    default: return a[0] ?? ""; // Resource|X, Faction|X, M|X, WF|X, A|X, Weapon|X|Y, E|Fire ... -> first argument
  }
}

export function cleanWikitext(input: string, pagename = ""): string {
  let s = input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[a-z][^>]*>/gi, "");
  for (let guard = 0; guard < 50 && TEMPLATE.test(s); guard++) s = s.replace(TEMPLATE, (_m, name, rest) => renderTemplate(name, rest, pagename));
  return s
    .replace(/\[\[(?:File|Image|Category):[^\]]*\]\]/gi, "")
    .replace(/\[\[([^\]|#]*)(?:#[^\]|]*)?\|([^\]]*)\]\]/g, "$2")
    .replace(/\[\[([^\]|#]*)(?:#[^\]]*)?\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1")
    .replace(/'{2,5}/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ +([.,;:])/g, "$1")
    .trim();
}

/** Targets of [[wiki links]] (page names only) — useful as structured "where" data. */
export function linkTargets(raw: string): string[] {
  const out = new Set<string>();
  for (const m of raw.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)) {
    const t = m[1].trim();
    if (!/^(file|image|category):/i.test(t)) out.add(t.replace(/_/g, " "));
  }
  return [...out];
}

/** Finds the first {{name|...}} call (brace-balanced): its inner text and where it ends in the source. */
function findTemplate(wikitext: string, name: string): { inner: string; end: number } | null {
  const start = wikitext.search(new RegExp(`\\{\\{\\s*${name}\\s*[|}]`, "i"));
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < wikitext.length - 1; i++) {
    if (wikitext.startsWith("{{", i)) { depth++; i++; }
    else if (wikitext.startsWith("}}", i)) {
      depth--; i++;
      if (depth === 0) {
        const inner = wikitext.slice(start + 2, i - 1).replace(new RegExp(`^\\s*${name}\\s*\\|?`, "i"), "");
        return { inner, end: i + 1 };
      }
    }
  }
  return null;
}

/** Returns the inner text of the first {{name|...}} call (brace-balanced), or null. */
export function extractTemplate(wikitext: string, name: string): string | null {
  return findTemplate(wikitext, name)?.inner ?? null;
}

/** Body of a `==Heading==` section (up to the next heading of the same or higher level). */
export function extractSection(wikitext: string, heading: string): string | null {
  const re = new RegExp(`^(={2,})\\s*${heading}\\s*\\1\\s*$`, "im");
  const m = re.exec(wikitext);
  if (!m) return null;
  const rest = wikitext.slice(m.index + m[0].length);
  const next = new RegExp(`^={2,${m[1].length}}[^=].*$`, "m").exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
}

export type DropKind = "drop" | "reward" | "vendor" | "event" | "other";

export interface DropSource {
  text: string;
  kind: DropKind;
  /** Wiki pages mentioned (missions, bosses, vendors, relics...). */
  links: string[];
  /** Sub-bullets (e.g. "Infernum 6 and 13 awards 1."). */
  details: string[];
}

function kindOf(text: string): DropKind {
  if (/\b(bought|buy|purchas\w*|sold|sells?|vendor)\b/i.test(text)) return "vendor";
  if (/\b(event|operation|nightwave|baro)\b/i.test(text)) return "event";
  if (/\b(drop|dropped|drops|may drop)\b/i.test(text)) return "drop";
  if (/\b(award|reward|appear as)\w*/i.test(text)) return "reward";
  return "other";
}

/** Parses an Acquisition template body or section into structured drop sources. */
export function parseAcquisition(raw: string, pagename: string): DropSource[] {
  const body = raw.replace(/\|\s*header\s*=\s*\w+\s*$/i, "").trim();
  const items: { raw: string; details: string[] }[] = [];
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const sub = /^(\*{2,}|:+)\s*(.*)$/.exec(t);
    if (sub && items.length) { items[items.length - 1].details.push(sub[2]); continue; }
    const top = /^\*\s*(.*)$/.exec(t);
    items.push({ raw: top ? top[1] : t, details: [] });
  }
  return items
    .map((it) => ({
      text: cleanWikitext(it.raw, pagename),
      kind: kindOf(cleanWikitext(it.raw, pagename)),
      links: linkTargets(it.raw),
      details: it.details.map((d) => cleanWikitext(d, pagename)).filter(Boolean),
    }))
    .filter((d) => d.text.length > 0);
}

/**
 * Acquisition info from {{Acquisition|...}}, an ==Acquisition== section, or — on newer pages — a bare
 * `{{Acquisition|name={{PAGENAME}}}}` whose actual text follows the template, up to the next heading.
 */
export function extractDropSources(wikitext: string, pagename: string): DropSource[] {
  const tpl = findTemplate(wikitext, "Acquisition");
  if (tpl) {
    const hasBody = tpl.inner.split("|").some((part) => part.trim() && !/^\s*\w+\s*=/.test(part));
    if (hasBody) return parseAcquisition(tpl.inner, pagename);
    const after = wikitext.slice(tpl.end);
    const next = after.search(/^={2,}[^=]/m);
    const prose = (next < 0 ? after : after.slice(0, next)).trim();
    return prose ? parseAcquisition(prose, pagename) : [];
  }
  const section = extractSection(wikitext, "Acquisition");
  return section ? parseAcquisition(section, pagename) : [];
}

/** Bullets from ==Notes==/==Tips== that talk about what the arcane works with. */
export function extractCompatNotes(wikitext: string, pagename: string, max = 6): string[] {
  const out: string[] = [];
  for (const sec of ["Notes", "Tips"]) {
    const body = extractSection(wikitext, sec);
    if (!body) continue;
    for (const line of body.split(/\r?\n/)) {
      if (!/^\*(?!\*)/.test(line.trim())) continue; // top-level bullets only
      const text = cleanWikitext(line.trim().replace(/^\*\s*/, ""), pagename);
      if (text.length > 15 && text.length < 260 && /\b(equip|works?|appl(?:y|ies)|affect|benefit|scal|trigger|stack|ability|abilit|exalted|doesn.?t|cannot|can not|only)\b/i.test(text)) out.push(text);
    }
  }
  return out.slice(0, max);
}

// ───────────────────────── Ability tables (which abilities trigger / are excluded) ─────────────────────────

export interface AbilityEntry {
  /** Owning Warframe, or null for rows that span both columns (e.g. "Exalted Weapons"). */
  warframe: string | null;
  name: string;
  helminth: boolean;
  note: string | null;
}
export interface AbilityList {
  /** Heading the table sits under, e.g. "Valid Objects". */
  title: string;
  kind: "valid" | "invalid";
  /** The sentence introducing the table, if any ("Only the following abilities can trigger this effect:"). */
  intro: string | null;
  abilities: AbilityEntry[];
}

/** Splits on the first top-level "|" (ignoring ones inside [[...]] / {{...}}) to separate cell attributes from content. */
function splitCellAttrs(cell: string): { attrs: string; content: string } {
  let depth = 0;
  for (let i = 0; i < cell.length; i++) {
    const two = cell.slice(i, i + 2);
    if (two === "[[" || two === "{{") { depth++; i++; }
    else if (two === "]]" || two === "}}") { depth = Math.max(0, depth - 1); i++; }
    else if (cell[i] === "|" && depth === 0) return { attrs: cell.slice(0, i), content: cell.slice(i + 1) };
  }
  return { attrs: "", content: cell };
}

interface Cell { content: string; rowspan: number; colspan: number }

function parseRows(table: string): { header: string[]; rows: Cell[][] } {
  const lines = table.split(/\r?\n/);
  const header: string[] = [];
  const rows: Cell[][] = [];
  let row: Cell[] | null = null;
  let cur: { text: string } | null = null;

  const flushCell = () => {
    if (!cur || !row) return;
    const { attrs, content } = splitCellAttrs(cur.text.trim());
    row.push({
      content: content.trim(),
      rowspan: Number(/rowspan\s*=\s*"?(\d+)/i.exec(attrs)?.[1] ?? 1),
      colspan: Number(/colspan\s*=\s*"?(\d+)/i.exec(attrs)?.[1] ?? 1),
    });
    cur = null;
  };

  for (const line of lines) {
    const t = line.trimEnd();
    if (/^\{\|/.test(t) || /^\|\+/.test(t)) continue;
    if (/^\|-/.test(t)) { flushCell(); if (row && row.length) rows.push(row); row = []; continue; }
    if (/^\|\}/.test(t)) { flushCell(); if (row && row.length) rows.push(row); row = null; continue; }
    if (/^!/.test(t)) {
      flushCell();
      for (const h of t.replace(/^!/, "").split("!!")) header.push(cleanWikitext(splitCellAttrs(h).content.trim() || h.trim()).toLowerCase());
      continue;
    }
    if (/^\|/.test(t)) {
      flushCell();
      row = row ?? [];
      const body = t.replace(/^\|/, "");
      if (body.includes("||")) for (const part of body.split("||")) { cur = { text: part }; flushCell(); } // several cells on one line
      else cur = { text: body }; // one cell; continuation lines (e.g. "*Only when ...") are appended until the next "|"
      continue;
    }
    if (cur) cur.text += "\n" + t; // continuation line (e.g. "*Only when ...")
  }
  flushCell();
  if (row && row.length) rows.push(row);
  return { header, rows };
}

const cleanNote = (raw: string, page: string) =>
  cleanWikitext(raw.split(/\r?\n/).map((l) => l.replace(/^[\s*:]+/, "")).filter(Boolean).join(" "), page) || null;

/** Looks like `{{A|Target|Display}}`: the first arg is the ability's real name (used for Helminth lookups). */
const abilityTarget = (raw: string) => /\{\{\s*A\s*\|\s*([^|}]+)/i.exec(raw)?.[1].trim() ?? null;

/**
 * Parses every wikitable with Warframe + Ability columns (Arcane Sculptor's "Valid/Invalid Objects",
 * Arcane Intention's "Eligible Abilities", ...). Handles rowspan'd Warframe cells, colspan'd special rows,
 * and multi-line notes. `helminthOf` supplies the Subsumable flag when the table has no such column.
 */
export function extractAbilityLists(
  wikitext: string,
  pagename: string,
  helminthOf?: (warframe: string, ability: string) => boolean | undefined,
): AbilityList[] {
  const out: AbilityList[] = [];
  const tableRe = /\{\|[^\n]*\n[\s\S]*?\n\|\}/g;
  let m: RegExpExecArray | null;
  while ((m = tableRe.exec(wikitext))) {
    const { header, rows } = parseRows(m[0]);
    const iWf = header.findIndex((h) => /^warframe/.test(h));
    const iAb = header.findIndex((h) => /^abilit/.test(h));
    if (iWf < 0 || iAb < 0) continue;
    const iSub = header.findIndex((h) => /subsumable/.test(h));
    const iNote = header.findIndex((h) => /^notes?$/.test(h));

    // nearest heading + intro line before this table
    const before = wikitext.slice(0, m.index);
    const heading = [...before.matchAll(/^={2,}\s*([^=\n]+?)\s*={2,}\s*$/gm)].pop()?.[1] ?? "Abilities";
    // The introducing sentence is the closest non-empty line above the table (looking through <noinclude> wrappers);
    // if that line is a heading there is no intro.
    const above = before.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^<\/?noinclude>$/i.test(l)).pop() ?? "";
    const intro = above && !/^={2,}.*={2,}$/.test(above) && !/^[{|!]/.test(above) ? cleanNote(above, pagename) : null;

    const carry: Record<number, { value: string; left: number }> = {}; // rowspan'd cells carried to following rows
    const abilities: AbilityEntry[] = [];
    for (const row of rows) {
      const cols: string[] = new Array(header.length).fill("");
      let i = 0;
      const cells = [...row];
      for (let c = 0; c < header.length; c++) {
        if (carry[c]?.left > 0) { cols[c] = carry[c].value; carry[c].left--; continue; }
        const cell = cells[i++];
        if (!cell) continue;
        cols[c] = cell.content;
        if (cell.rowspan > 1) carry[c] = { value: cell.content, left: cell.rowspan - 1 };
        if (cell.colspan > 1) { for (let k = 1; k < cell.colspan && c + k < header.length; k++) cols[c + k] = "\u0000span"; c += cell.colspan - 1; }
      }
      const spanned = cols[iAb] === "\u0000span";
      const warframe = spanned ? null : cleanWikitext(cols[iWf], pagename) || null;
      const raw = spanned ? cols[iWf] : cols[iAb];
      const name = cleanWikitext(raw, pagename).replace(/\s+/g, " ").trim();
      if (!name) continue;
      const subCell = iSub >= 0 ? cols[iSub] : "";
      const known = warframe ? helminthOf?.(warframe, abilityTarget(raw) ?? name) : undefined;
      // Some tables (Arcane Intention) flag Helminth abilities with "Helminth-transferable" inside the Notes cell.
      let note = iNote >= 0 && cols[iNote] ? cleanNote(cols[iNote], pagename) : null;
      const noteSaysHelminth = !!note && /helminth[- ]transferable/i.test(note);
      if (note) note = note.replace(/\s*helminth[- ]transferable\.?/gi, "").trim() || null;
      abilities.push({
        warframe,
        name,
        helminth: iSub >= 0 ? /subsumable/i.test(subCell) : !!known || noteSaysHelminth,
        note,
      });
    }
    if (abilities.length) out.push({ title: cleanWikitext(heading, pagename), kind: /invalid|ineligible|excluded|not /i.test(heading) ? "invalid" : "valid", intro, abilities });
  }
  return out;
}
