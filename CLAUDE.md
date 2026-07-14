# Portal SGM — Project Instructions

## What this is

Sistema de Gestão de Medição (SGM) portal. Dashboard read-only sobre dados
reais de medição de óleo/gás (MPFM, separador, poços ANP). Hospedado via
plataforma OpenAI Sites, runtime Cloudflare Workers + D1.

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (React 19) via `vinext` bridge |
| Build/dev | Vite 8 + `@cloudflare/vite-plugin` |
| Runtime | Cloudflare Workers, D1 (SQLite), R2 |
| DB layer | Drizzle ORM (schema+migrations), raw SQL for reads |
| Styling | Tailwind 4 (plain CSS also used: `app/data-quality.css`) |
| Charts | Recharts |
| Tests | `node --test` (no unit/integration framework configured) |

## Non-negotiable project rule: no fake data

This is the core constraint of the whole app — **never break it**:

- Never render placeholder, mock, or "demonstrative" numbers in the UI.
- If data is unavailable, show an explicit empty/error state
  (see `DataState` / `EmptyRows` in `app/page.jsx`) — never a fallback number.
- Every measurement row must trace back to a `source_files` record
  (file name, SHA-256, period). Don't add data paths that bypass this.
- Zero and absence are different states. Don't auto-classify a zero as a
  failure or auto-mark anything "Conforme" — see `docs/data-quality/oil-linear.md`.
- Raw/private source data never enters the repo (`data/raw/`, `data/private/`,
  `docs/inventory/*.csv` are gitignored — keep it that way).

## Project Structure

```
worker/index.ts                 Cloudflare Worker entry (delegates to vinext)
app/page.jsx                    Entire dashboard UI (single client component)
app/api/portal-data/route.ts    Only API route — raw SQL reads against D1
db/schema.ts                    Drizzle schema (source of truth for tables)
drizzle/*.sql                   Migrations (0001 also carries seed data — large)
scripts/import-real-data.py     Source spreadsheet → D1 import pipeline
scripts/analyze-oil-linear.py   Data quality profiling for source spreadsheet
docs/                           Data provenance/decision records (source-selection,
                                 data-quality) — update when data sourcing changes
tests/                          node:test — build artifact + migration checks
```

## Common Tasks

- Dev server: `npm run dev`
- Build (verified, bounded timeout): `npm run build`
- Start built app: `npm run start`
- Test: `npm test` (builds first, then runs `tests/rendered-html.test.mjs`)
- Lint: `npm run lint`
- Generate Drizzle migration from schema changes: `npm run db:generate`
- Validate build artifact: `npm run validate:artifact`

## Conventions

- `db/schema.ts` is the source of truth for tables — edit it, then
  `npm run db:generate`, don't hand-write migration SQL for schema changes.
- API route reads use raw parameterized SQL (`env.DB.prepare(sql).bind(...)`),
  not the Drizzle query builder — stay consistent within `app/api/`, and if
  you add user-controlled filters, keep using `.bind()`, never string-concat SQL.
- Portuguese (pt-BR) is the UI language and the language of docs/comments in
  this repo — keep new user-facing strings and doc files in pt-BR.
- Commit messages: normal sentence, no strict conventional-commit type enforced
  by tooling here (see `git log` for house style — short imperative English
  summaries).

## Known Rough Edges (from onboarding review, 2026-07-14)

- `app/page.jsx` is a 140-line file but functionally monolithic — most
  components are single-line JSX with 5-10 responsibilities inlined
  (e.g. `Cadastros`, `SourcesTable`). Fine for now; if it grows, split into
  `src/components/` before adding new views, not after.
- No unit/integration tests cover `app/api/portal-data/route.ts` — the SQL
  there has real logic (CTEs, aggregations for data-quality metrics). Worth
  testing directly if that query logic changes.
- `drizzle/0001_real_source_data.sql` (8948 lines) mixes schema migration
  with data seeding. Don't follow this pattern going forward — keep schema
  migrations and data loads separate.
