# Riven Buddy

Price, grade and manage Warframe riven mods; look up arcanes. Next.js (App Router, TS, Tailwind) + Supabase, deployable to Vercel. One responsive codebase: bottom tabs on phones, sidebar on desktop.

## Accounts are optional

- **No account:** check a riven (per-stat grades + market estimate — it lives in the URL, nothing is stored) and browse arcanes with live prices.
- **With an account:** save and edit rivens, and list them on Warframe Market.
- **Screenshot scan is open to everyone** but rate limited (6 per 10 min per visitor, `SCAN_DAILY_LIMIT` per day per server instance, in-memory so best-effort). Set a monthly spend limit on your Anthropic key for a hard ceiling.
- Game reference tables (weapons, stats, riven grading data, arcanes) are publicly readable (migration 0007); user data and token tables are not.
- The public market endpoint (`/api/market/riven`) uses the same throttle + cache as everything else, but it is open to anyone — add rate limiting before sharing the URL widely.

## Setup

1. `npm install`
2. Create a Supabase project, run `supabase/migrations/0001…0015` in order (SQL editor or `supabase db push`).
3. `cp .env.example .env.local` and fill it in (Supabase URL/keys; `WFM_TOKEN_ENCRYPTION_KEY` via `openssl rand -base64 32`; optional `ANTHROPIC_API_KEY` for screenshot scanning).
4. Load reference data (re-runnable any time):
   ```bash
   npm run sync:wfm-static          # weapons (+disposition) and riven stat definitions, from Warframe Market
   npm run sync:wiki-arcanes        # arcanes, drop sources, compatibility, Vosfor collections, from the Warframe Wiki (+ WFM ids)
   npm run sync:arcane-prices       # rank-0 market prices + 48h sales for every arcane (the app also keeps these fresh by itself)
   npm run sync:primes              # data/primes.json: every Prime part/set and Lith–Axi relic (drops, vaulted) — commit the result
   npm run sync:item-prices         # Prime part/set prices (the app also keeps these fresh by itself)
   ```
   `-- --dry-run` on the sync scripts writes JSON to `data/generated/` instead of touching the DB.
5. `npm run dev`

## Swapping in real data (no code changes)

| Data | Where | How |
|---|---|---|
| Riven roll ranges (every stat × weapon category × layout), ±10% roll, grade bands, weapon categories | `data/rivencalc.json` (committed) | `npm run sync:rivencalc` re-scrapes browse.wf/rivencalc (formulas are confirmed from its source; it fails loudly if they change) and rewrites the file; `-- --check` only compares. `npm run verify:rivencalc` cross-checks the stored numbers against the live page in headless Chromium. Disposition is locked at 1.2. WFM stat → calculator stat map: `data/rivencalc-stat-map.json`. Stats browse.wf has no range for are filled from the Unified-Codex calculator (`fallback` in the file; map: `data/codex-stat-map.json`). |
| Arcane prices (rank 0) | `arcane_prices` | Refreshed in the background while anyone has the Arcanes page open (a few at a time, only stale rows, shared by everyone); `npm run sync:arcane-prices` does a full pass. |
| Vosfor collections (Loid) | `arcane_collections` | `npm run sync:wiki-arcanes` reads the wiki's table and cross-checks each pool's size and the odds; it fails loudly if the page changes. |
| Prime parts & relics | `data/primes.json` (committed) | `npm run sync:primes` (Warframe Market items + the game's relic/reward export). Relic refinement odds are in `src/lib/primes/relic-value.ts` (from the wiki's Void Relic page). |
| Prime part / set prices | `item_prices` | Refreshed in the background (a few at a time, only stale rows) while anyone has the Primes pages open; `npm run sync:item-prices` does a full pass. |
| Weapon riven market | `weapon_riven_prices` | Refreshed in the background by the Weapon ranking page: for each weapon, the median ask of its cheapest ≤99 buy-it-now rivens and the stats that ask more. |
| Per-ability arcane compatibility, drop-source corrections | `data/arcane-overrides.json` | Wins over the wiki; re-run `sync:wiki-arcanes`. |
| Readable labels for wiki stat tags | `data/arcane-upgrade-types.json` | Sync prints any unmapped tags. |
| Stats that are good when negative (Recoil) | `data/riven-attribute-overrides.json` | Re-run `sync:wfm-static`. |
| **Curse (negative stat) ratings**, general per stat plus per-weapon overrides | `data/curse-ratings.json` | Edit and redeploy. `stats` maps a stat slug to S/A/B/C/D/F; `weapons` maps a weapon name (as shown in the app) to stat → grade and beats the general rating. A typo'd grade fails at startup and the tests check slugs and weapon names. Curses not listed there are graded by their roll. |
| Grade list (display order/colours) | `src/lib/grading/config.ts` | The roll band cut-offs come from the scraped data. |

## Things worth knowing

- **Riven auctions are v1-only.** Warframe Market v2 has no riven auction endpoint, so pricing and listing use `/v1/auctions/*`; everything else uses v2. Closing a listing is `PUT …/close` (DELETE returns 405).
- **Pricing:** `src/lib/wfm/valuation.ts` turns the comparable listings into a range: each ask is adjusted for how its roll quality (from the per-stat grades, curse rating included) compares with yours, troll and mispriced asks are dropped statistically (log-price median ± 3 robust deviations), exact-stat, fresher, closer-valued, in-game listings weigh more, and each seller counts once. The result is the weighted 25th/50th/75th percentile plus a confidence label. Every constant is in `VALUATION`. The roll-quality elasticity (0.7: best roll ≈ 2× the worst) is a prior, not a fit — public asking prices cluster at round defaults, so it can't be measured from them. Asks are not sales; real sale prices are usually lower.
- **Vault worth:** My Rivens shows each riven's last estimate (stored on the row, migration 0011), re-prices stale ones one at a time in the background, and totals them. Editing a riven clears its estimate.
- **Scan inventory (`/primes/scan`):** attach screenshots of your Prime parts (up to 12). Each is sent to Claude vision (`src/lib/primes/scan-read.ts`, needs `ANTHROPIC_API_KEY`, rate limited), the names are matched to the Prime catalogue (`scan-match.ts`: exact, else a close match that is clearly better than the runner-up, else listed as unmatched), items seen in overlapping screenshots are counted once (largest quantity), and everything is valued at the 5-cheapest-listings price, most expensive first. Counts are editable; signed-in users can add the result to their inventory.
- **Arcane prices:** an arcane's price is the **average of the 5 cheapest online rank-0 sell listings** (from the full order list, `/v2/orders/item/{slug}` — the `/top` endpoint is NOT a cheapest-5 list), with the cheapest listing shown beside it and the last 48 hours' sales volume from the statistics endpoint. If there aren't 5 rank-0 listings, it's the **cheapest online max-rank listing ÷ the copies a max-rank arcane is made of** (21 for rank 5, 10 for rank 3: ranks 0…5 take 1, 3, 6, 10, 15, 21 copies) — see `src/lib/arcanes/effective-price.ts`. With no max-rank listing either, the few rank-0 listings are shown flagged "thin". Only online sellers count. These are asking prices, not sales.
- **Vosfor collections:** each of Loid's 9 collections costs 200 Vosfor + 50,000 credits for 3 arcanes. The page ranks them by the plain average price of the arcanes in the collection, and also shows an odds-weighted figure (rarity chances × the average price within each rarity) — the closest thing to "platinum per pack".
- **Primes:** the Prime parts page ranks parts and sets by price (average of the 5 cheapest online listings) with ducats and vault status; the Best relics page values each relic as the expected platinum from one reward pick at each refinement (odds × price; Forma counts as 0). A part is "vaulted" only if every relic that drops it is.
- **Weapon ranking:** Warframe Market publishes no riven sales data, so weapons are ranked by the median *asking* price of their cheapest buy-it-now rivens (up to 99 per weapon). For popular weapons that describes the low end of the market. "Stats that ask more" compares listings with and without a stat in that same sample.
- **Live:** `/live` shows the world state (cycles, fissures, Baro, sortie, archon hunt, Teshin, Darvo, Nightwave, invasions) from api.warframestat.us, cached for a minute per server instance.
- **Rate limiting:** one shared 350 ms throttle per server instance + a 12-minute cache (memory + `market_cache` table, stale-on-error). The throttle is per lambda; the shared cache is what keeps combined volume low.
- **Grading:** per stat, from browse.wf's Riven Calculator at a fixed 1.2 disposition: a ±10% roll around each stat's center, 11 bands (S … F). **Curses are different:** a curse's grade is a fixed rating for the stat (and weapon) from `data/curse-ratings.json`, not its roll — the gauge and band table still show where the roll sits, as information. A curse with no rating falls back to roll grading (a milder penalty grades higher, as on the calculator), and says so. Stats browse.wf doesn't list (combined elements, weak point stats, Zoom on shotguns …) are graded from the Unified-Codex calculator's ranges instead, and the result says so; they have no 1+/1- layout. 
- **Rank scaling:** riven stats scale with rank ((rank+1)/9). All comparisons and grading are normalised to rank 8.
- **WFM tokens:** passwords are never stored; the session token is AES-256-GCM encrypted (user id as AAD) in a table no client role can read.
- **Not verified live:** the WFM sign-in *success* path and listing creation (need a real account), and screenshot scanning (needs an API key). Request shapes were checked against the real API using fake credentials.
- Riven ranges vary with weapon type and the number of bonus/curse stats; `data/rivencalc.json` has every combination at the fixed 1.2× disposition (see "Grading" below).

Scripts: `npm test`, `npm run typecheck`, `npm run price-check -- soma "Crita-cron" critical_chance=150 …` (live market lookup).
