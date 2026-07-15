# Portal SGM — Project Instructions

## What this is

Sistema de Gestão de Medição (SGM) portal. Dashboard read-only sobre dados
reais de medição de óleo/gás (MPFM, separador, poços ANP). Hospedado via
plataforma OpenAI Sites, runtime Cloudflare Workers + D1.

**Git remote is not GitHub.** `origin` is `git.chatgpt-team.site` (the
platform's own git host). GitHub-specific tooling (GitHub Actions, `gh`
commands assuming a GitHub repo) does not apply here. Publishing likely
happens through the platform UI, not `git push` — this environment has no
credentials for that remote.

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (React 19) via `vinext` bridge |
| Build/dev | Vite 8 + `@cloudflare/vite-plugin` |
| Runtime | Cloudflare Workers, D1 (SQLite), R2 |
| DB layer | Drizzle ORM (schema+migrations), raw SQL for reads |
| Styling | Tailwind 4 (plain CSS also used, colocated per component) |
| Charts | Recharts |
| Tests | `node --test` (no external framework; node:sqlite for DB-backed tests) |

## Non-negotiable project rule: no fake data

This is the core constraint of the whole app — **never break it**:

- Never render placeholder, mock, or "demonstrative" numbers in the UI.
- If data is unavailable, show an explicit empty/error state
  (see `DataState` / `EmptyRows` in `src/components/portal/Shared.jsx`) —
  never a fallback number.
- Every measurement row must trace back to a `source_files` record
  (file name, SHA-256, period). Don't add data paths that bypass this.
- Zero and absence are different states. Don't auto-classify a zero as a
  failure or auto-mark anything "Conforme" — see `docs/data-quality/oil-linear.md`.
- Raw/private source data never enters the repo (`data/raw/`, `data/private/`,
  `docs/inventory/*.csv` are gitignored — keep it that way).

## Project Structure

```
worker/index.ts                 Cloudflare Worker entry (delegates to vinext)
app/page.jsx                    Thin re-export of PortalApp (Next app router page)
app/api/portal-data/route.ts    Production dashboard API — thin wrapper around db/portal-data.ts
app/api/calibration/route.ts    MPFM calibration campaign API — thin wrapper around db/calibration.ts
db/portal-data.ts               Production dashboard query logic — D1-shaped db, testable
db/calibration.ts               Assembles a calibration Campaign (see below) — D1-shaped db, testable
db/schema.ts                    Drizzle schema (source of truth for tables)
drizzle/*.sql                   Migrations (0001 and 0003 also carry seed data — large)
src/components/portal/          Dashboard UI, one view per file (PortalApp is the shell)
scripts/import-real-data.py     Source spreadsheet → D1 import pipeline (production tables)
scripts/import-mpfm-calibration.py  Calibration campaign Excel → D1 import (calibration_* tables)
apps/calibration/                Standalone MPFM calibration engine (own npm project — see below)
public/calibracao/               Built static output of apps/calibration/, served at /calibracao/
scripts/analyze-oil-linear.py   Data quality profiling for source spreadsheet
scripts/cloudflare-node-stub.mjs  Node loader stub so cloudflare:* imports resolve
                                   under plain Node during validate-artifact.sh only
docs/                           Data provenance/decision records (source-selection,
                                 data-quality) — update when data sourcing changes
tests/                          node:test — build artifact, query logic, migration checks
```

### Calibration domain (`calibration_*` tables)

Separate from the continuous-production tables (`mpfm_measurements`, etc.): a
calibration campaign is a bounded, per-TAG K-factor commissioning/verification
event (AS_FOUND/POST_K windows), not a stream of ongoing readings. Added
2026-07-14 to feed the MPFM calibration engine (16-gate metrology workflow,
`calculate()` in `apps/calibration/src/main.tsx`) — as of Phase 1
(2026-07-14) that engine's front-end lives in this repo under
`apps/calibration/`, but as its own independent npm project: its
`npm install`/`build`/`test` run from inside that directory and are **not**
wired into the root's `scripts/install-ci.sh` / `scripts/build-verified.sh`.
Its build output is committed as static files under `public/calibracao/` and
served at `/calibracao/` by the same Next.js static-file handling that already
serves `public/favicon.svg` — no Worker or Vite routing changes needed. Portal
SGM and the calibration app link to each other (sidebar buttons) but stay
independent SPAs — no shared React tree, no shared CSS, no shared client
state. `db/calibration.ts` → `loadCalibrationCampaign` returns a payload
shaped to match that engine's `Campaign`/`Row` types field for field, so it
can be fed to `calculate()` with no reshaping. As of Phase 2 (2026-07-14),
`PUT /api/calibration?campaignId=` (`db/calibration-write.ts` →
`saveCalibrationCampaign`) persists edits back to the same tables — scoped to
exactly the fields the engine's `Campaign` type carries (scalar fields,
envelope, PVT, K-factors, uncertainty, evidence/approvals). Everything under
`campaign.raw` stays read-only/import-only. The Metrolog app's "Salvar"
button calls this endpoint (same origin as of Phase 1) in addition to its
existing `localStorage` save. As of Phase 4 (2026-07-14), `POST
/api/calibration` (`createCalibrationCampaign`) creates a brand-new campaign
from the app itself, via a "Solicitar calibração" modal — `scripts/
import-mpfm-calibration.py` remains available for bulk/offline creation but
is no longer the only path. As of Phase 5 (2026-07-15), `rows` (MPFM/
separator readings) are no longer purely import-only either: `PUT
/api/calibration/rows?campaignId=&condition=` (`saveCalibrationRows` in
`db/calibration-rows-write.ts`) lets the app itself extract an As-Found or
Pós-K window straight from the real monthly production Excel
(`BASE_UNICA_MES` sheet) and the real separator Excel (block-per-day/hour
format), client-side, and upsert the result — keyed by
`(campaign_id, condition, timestamp)`, so re-uploading a window corrects it
in place instead of duplicating rows. Fields the v1 engine doesn't consume
yet (separator, lab, PVT/K/uncertainty detail) still come back under
`campaign.raw` for traceability and future engine versions.
Raw source Excel samples still stay out of the repo (same "no raw source
docs" policy as `docs/source-selection.md`) — only derived numeric rows are
committed, via `scripts/import-mpfm-calibration.py`.

## Common Tasks

- Dev server: `npm run dev`
- Build (verified, bounded timeout): `npm run build`
- Local production-shaped preview: `npm run start` (runs `vite preview`, backed by
  workerd via `@cloudflare/vite-plugin` — **not** `vinext start`, which executes
  the built worker under plain Node and crashes on any `cloudflare:workers` import)
- Test: `npm test` (builds first, then runs every `tests/*.test.mjs`)
- Lint: `npm run lint`
- Generate Drizzle migration from schema changes: `npm run db:generate`
- Validate build artifact: `npm run validate:artifact`

## Conventions

- `db/schema.ts` is the source of truth for tables — edit it, then
  `npm run db:generate`, don't hand-write migration SQL for schema changes.
- Query logic lives in `db/*.ts` functions that accept a minimal D1-shaped
  interface (`{ prepare(sql).bind(...).all()/.first() }`) instead of importing
  `cloudflare:workers` directly — that's what makes them testable against a
  node:sqlite shim (see `tests/portal-data-query.test.mjs`). API routes stay
  thin: import `env` from `cloudflare:workers`, pass `env.DB` in.
- Raw parameterized SQL (`.bind(...)`), not the Drizzle query builder, for reads
  — stay consistent, and if you add user-controlled filters, keep using
  `.bind()`, never string-concat SQL.
- One view/component per file under `src/components/portal/` — don't let
  `PortalApp.jsx` (the shell) grow view logic again.
- Portuguese (pt-BR) is the UI language and the language of docs/comments in
  this repo — keep new user-facing strings and doc files in pt-BR.
- Commit messages: normal sentence, no strict conventional-commit type enforced
  by tooling here (see `git log` for house style — short imperative English
  summaries).

## Known Rough Edges (from onboarding review, 2026-07-14)

- `drizzle/0001_real_source_data.sql` (8948 lines) mixes schema migration
  with data seeding. Don't follow this pattern going forward — keep schema
  migrations and data loads separate.
- "Desempenho MPFM" view is intentionally "Não avaliável" — no MPFM×separator
  temporal alignment exists yet. That's a real feature gap requiring a
  business-rule decision (alignment window, conformance criteria), not
  something to infer and implement unprompted.
- No CI is wired up on this remote (see the git-remote note above) — build
  breakage (like the `cloudflare:workers`/Node issues fixed 2026-07-14) can
  go unnoticed until someone runs `npm test` locally.
