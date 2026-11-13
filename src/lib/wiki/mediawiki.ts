/**
 * Tiny MediaWiki API client for wiki.warframe.com. Used by the sync scripts (not at
 * request time). Polite by design: identifies itself, sends `maxlag`, batches titles and
 * sleeps between requests.
 */
const API = "https://wiki.warframe.com/api.php";
const UA = "WarframeEconomist/0.1 (personal Warframe tool; wiki sync script)";

async function api(params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", maxlag: "5", ...params })}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (res.status === 429 || res.status === 503) {
      if (attempt >= 3) throw new Error(`wiki API busy (${res.status})`);
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`wiki API ${res.status}`);
    const json = (await res.json()) as Record<string, unknown>;
    if ((json.error as { code?: string } | undefined)?.code === "maxlag") { await sleep(3000); continue; }
    return json;
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface WikiPage { title: string; content: string | null; revid: number | null; timestamp: string | null }

/** Fetch current wikitext for many titles (50/request max; 20 used here), following redirects. */
export async function fetchPages(titles: string[], batchSize = 20, delayMs = 600): Promise<Map<string, WikiPage>> {
  const out = new Map<string, WikiPage>();
  for (let i = 0; i < titles.length; i += batchSize) {
    const batch = titles.slice(i, i + batchSize);
    const json = (await api({
      action: "query", prop: "revisions", rvprop: "content|ids|timestamp", rvslots: "main", redirects: "1", titles: batch.join("|"),
    })) as { query?: { pages?: { title: string; missing?: boolean; revisions?: { revid: number; timestamp: string; slots: { main: { content: string } } }[] }[]; redirects?: { from: string; to: string }[]; normalized?: { from: string; to: string }[] } };
    const alias = new Map<string, string>(); // requested title -> canonical title
    for (const n of json.query?.normalized ?? []) alias.set(n.from, n.to);
    for (const r of json.query?.redirects ?? []) alias.set(alias.get(r.from) ?? r.from, r.to);
    const byTitle = new Map((json.query?.pages ?? []).map((p) => [p.title, p]));
    for (const t of batch) {
      const final = alias.get(t) ?? t;
      const p = byTitle.get(final);
      const rev = p?.revisions?.[0];
      out.set(t, { title: final, content: rev?.slots.main.content ?? null, revid: rev?.revid ?? null, timestamp: rev?.timestamp ?? null });
    }
    if (i + batchSize < titles.length) await sleep(delayMs);
  }
  return out;
}

export async function fetchPage(title: string): Promise<WikiPage> {
  return (await fetchPages([title])).get(title)!;
}
