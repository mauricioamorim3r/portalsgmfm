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
app/api/portal-data/route.ts    Only API route — thin wrapper around db/portal-data.ts
db/portal-data.ts               Query logic (SQL + shaping), takes a D1-shaped db — testable
db/schema.ts                    Drizzle schema (source of truth for tables)
drizzle/*.sql                   Migrations (0001 also carries seed data — large)
src/components/portal/          Dashboard UI, one view per file (PortalApp is the shell)
scripts/import-real-data.py     Source spreadsheet → D1 import pipeline
scripts/analyze-oil-linear.py   Data quality profiling for source spreadsheet
scripts/cloudflare-node-stub.mjs  Node loader stub so cloudflare:* imports resolve
                                   under plain Node during validate-artifact.sh only
docs/                           Data provenance/decision records (source-selection,
                                 data-quality) — update when data sourcing changes
tests/                          node:test — build artifact, query logic, migration checks
```

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
