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

/** Returns the inner text of the first {{name|...}} call (brace-balanced), or null. */
export function extractTemplate(wikitext: string, name: string): string | null {
  const start = wikitext.search(new RegExp(`\\{\\{\\s*${name}\\s*[|}]`, "i"));
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < wikitext.length - 1; i++) {
    if (wikitext.startsWith("{{", i)) { depth++; i++; }
    else if (wikitext.startsWith("}}", i)) {
      depth--; i++;
      if (depth === 0) {
        const inner = wikitext.slice(start + 2, i - 1);
        return inner.replace(new RegExp(`^\\s*${name}\\s*\\|?`, "i"), "");
      }
    }
  }
  return null;
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

/** Acquisition info from either {{Acquisition|...}} or an ==Acquisition== section. */
export function extractDropSources(wikitext: string, pagename: string): DropSource[] {
  const raw = extractTemplate(wikitext, "Acquisition") ?? extractSection(wikitext, "Acquisition");
  return raw ? parseAcquisition(raw, pagename) : [];
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
