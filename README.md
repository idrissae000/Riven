# Riven Buddy

Price, grade and manage Warframe riven mods; look up arcanes. Next.js (App Router, TS, Tailwind) + Supabase, deployable to Vercel. One responsive codebase: bottom tabs on phones, sidebar on desktop.

## Setup

1. `npm install`
2. Create a Supabase project, run `supabase/migrations/0001…0005` in order (SQL editor or `supabase db push`).
3. `cp .env.example .env.local` and fill it in (Supabase URL/keys; `WFM_TOKEN_ENCRYPTION_KEY` via `openssl rand -base64 32`; optional `ANTHROPIC_API_KEY` for screenshot scanning).
4. Load reference data (re-runnable any time):
   ```bash
   npm run sync:wfm-static          # weapons (+disposition) and riven stat definitions, from Warframe Market
   npm run sync:wiki-arcanes        # arcanes, drop sources, compatibility, from the Warframe Wiki (+ WFM ids)
   npm run seed:grading-placeholder # PLACEHOLDER roll ranges so grading is testable
   ```
   `-- --dry-run` on the sync scripts writes JSON to `data/generated/` instead of touching the DB.
5. `npm run dev`

## Swapping in real data (no code changes)

| Data | Where | How |
|---|---|---|
| Riven min/max roll tables | `riven_grade_ranges` | `npm run import:grading -- your.csv` (columns `weapon,stat,min,max,is_negative`; `weapon=*` = default for all weapons; values signed, as displayed at **max rank**). Add `--replace-placeholders` to drop the stand-ins. |
| Per-ability arcane compatibility, drop-source corrections | `data/arcane-overrides.json` | Wins over the wiki; re-run `sync:wiki-arcanes`. |
| Readable labels for wiki stat tags | `data/arcane-upgrade-types.json` | Sync prints any unmapped tags. |
| Stats that are good when negative (Recoil) | `data/riven-attribute-overrides.json` | Re-run `sync:wfm-static`. |
| Grade tier cut-offs | `src/lib/grading/config.ts` | |

## Things worth knowing

- **Riven auctions are v1-only.** Warframe Market v2 has no riven auction endpoint, so pricing and listing use `/v1/auctions/*`; everything else uses v2. Closing a listing is `PUT …/close` (DELETE returns 405).
- **Rate limiting:** one shared 350 ms throttle per server instance + a 12-minute cache (memory + `market_cache` table, stale-on-error). The throttle is per lambda; the shared cache is what keeps combined volume low.
- **Rank scaling:** riven stats scale with rank ((rank+1)/9). All comparisons and grading are normalised to rank 8.
- **WFM tokens:** passwords are never stored; the session token is AES-256-GCM encrypted (user id as AAD) in a table no client role can read.
- **Not verified live:** the WFM sign-in *success* path and listing creation (need a real account), and screenshot scanning (needs an API key). Request shapes were checked against the real API using fake credentials.
- Riven Disposition was retired by the game (all weapons 1.2x), so one range table normally covers every weapon. Ranges also vary with the number of bonus/curse stats (wiki "Attribute Value Formula") — the current table shape (`weapon, stat, min, max, is_negative`) doesn't capture that.

Scripts: `npm test`, `npm run typecheck`, `npm run price-check -- soma "Crita-cron" critical_chance=150 …` (live market lookup).
