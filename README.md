# Riven Buddy

Price, grade and manage Warframe riven mods; look up arcanes. Next.js (App Router, TS, Tailwind) + Supabase, deployable to Vercel. One responsive codebase: bottom tabs on phones, sidebar on desktop.

## Accounts are optional

- **No account:** check a riven (per-stat grades + market estimate — it lives in the URL, nothing is stored) and browse arcanes with live prices.
- **With an account:** save and edit rivens, and list them on Warframe Market.
- **Screenshot scan is open to everyone** but rate limited (6 per 10 min per visitor, `SCAN_DAILY_LIMIT` per day per server instance, in-memory so best-effort). Set a monthly spend limit on your Anthropic key for a hard ceiling.
- Game reference tables (weapons, stats, Codex grading data, arcanes) are publicly readable (migration 0007); user data and token tables are not.
- The public market endpoint (`/api/market/riven`) uses the same throttle + cache as everything else, but it is open to anyone — add rate limiting before sharing the URL widely.

## Setup

1. `npm install`
2. Create a Supabase project, run `supabase/migrations/0001…0009` in order (SQL editor or `supabase db push`).
3. `cp .env.example .env.local` and fill it in (Supabase URL/keys; `WFM_TOKEN_ENCRYPTION_KEY` via `openssl rand -base64 32`; optional `ANTHROPIC_API_KEY` for screenshot scanning).
4. Load reference data (re-runnable any time):
   ```bash
   npm run sync:wfm-static          # weapons (+disposition) and riven stat definitions, from Warframe Market
   npm run sync:wiki-arcanes        # arcanes, drop sources, compatibility, from the Warframe Wiki (+ WFM ids)
   npm run sync:codex-riven         # real riven base values, layouts, roll range and grade bands, from the Codex calculator
   ```
   `-- --dry-run` on the sync scripts writes JSON to `data/generated/` instead of touching the DB.
5. `npm run dev`

## Swapping in real data (no code changes)

| Data | Where | How |
|---|---|---|
| Riven base values, layout multipliers, ±10% roll range, grade bands | `riven_grading_data` (id `codex`) | `npm run sync:codex-riven` (re-runnable; `--dry-run` writes `data/generated/codex-riven.json`, `--file` parses a saved copy). Source: Unified-Codex/Codex-Calculators `index.html`. Needs `SUPABASE_SERVICE_ROLE_KEY`. WFM stat ↔ Codex name map: `data/codex-stat-map.json`. |
| Per-ability arcane compatibility, drop-source corrections | `data/arcane-overrides.json` | Wins over the wiki; re-run `sync:wiki-arcanes`. |
| Readable labels for wiki stat tags | `data/arcane-upgrade-types.json` | Sync prints any unmapped tags. |
| Stats that are good when negative (Recoil) | `data/riven-attribute-overrides.json` | Re-run `sync:wfm-static`. |
| Grade list / negative-stat convention (`NEGATIVE_STAT_GRADING`) | `src/lib/grading/config.ts` | Band cut-offs themselves come from the synced data. |

## Things worth knowing

- **Riven auctions are v1-only.** Warframe Market v2 has no riven auction endpoint, so pricing and listing use `/v1/auctions/*`; everything else uses v2. Closing a listing is `PUT …/close` (DELETE returns 405).
- **Rate limiting:** one shared 350 ms throttle per server instance + a 12-minute cache (memory + `market_cache` table, stale-on-error). The throttle is per lambda; the shared cache is what keeps combined volume low.
- **Rank scaling:** riven stats scale with rank ((rank+1)/9). All comparisons and grading are normalised to rank 8.
- **WFM tokens:** passwords are never stored; the session token is AES-256-GCM encrypted (user id as AAD) in a table no client role can read.
- **Not verified live:** the WFM sign-in *success* path and listing creation (need a real account), and screenshot scanning (needs an API key). Request shapes were checked against the real API using fake credentials.
- Riven Disposition was retired by the game (all weapons 1.2x), so one range table normally covers every weapon. Ranges also vary with the number of bonus/curse stats (wiki "Attribute Value Formula") — the current table shape (`weapon, stat, min, max, is_negative`) doesn't capture that.

Scripts: `npm test`, `npm run typecheck`, `npm run price-check -- soma "Crita-cron" critical_chance=150 …` (live market lookup).
