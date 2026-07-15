# Fase 5 — Extração de janela MPFM/Separador do Excel de produção Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the calibration app read the real monthly MPFM Excel (`BASE_UNICA_MES` sheet) and the real separator Excel (block-per-day/hour format), filter by TAG and by whichever window (As-Found or Pós-K) the user picked, and persist the resulting hourly rows to `calibration_mpfm_rows`/`calibration_separator_rows` — without depending on the main production import pipeline having already run for that period.

**Architecture:** Two new backend pieces — a `db/calibration-rows-write.ts` module (`saveCalibrationRows`, upserting both row tables keyed by `(campaign_id, condition, timestamp)` so re-uploads correct in place instead of duplicating) and a new `PUT /api/calibration/rows` route — plus two new frontend parsing functions in `apps/calibration/src/main.tsx` that use the `xlsx` library (already a dependency) to read the two real Excel formats client-side, entirely in the browser, then POST the extracted rows. Four new date/time inputs surface the window fields (`start`/`end`/`postStart`/`postEnd`) that already exist on `Campaign` but never had UI. The existing `corsHeaders` helper moves to a small shared module so both API route files can use it without duplication.

**Tech Stack:** TypeScript, D1 (`.batch()` upserts), React 19, the `xlsx` (SheetJS) npm package already used by `importFile`.

## Global Constraints

- Row-level MPFM/separator data is **never** typed manually — it only ever comes from parsing the real production Excel files client-side. No manual row-entry UI is added anywhere.
- Re-uploading/re-extracting the same window must **update** existing rows (matched by timestamp), never duplicate them — this is what the `ON CONFLICT (campaign_id, condition, timestamp) DO UPDATE` upserts guarantee.
- The user always explicitly picks which window a given upload targets ("Carregar janela As-Found" vs. "Carregar janela Pós-K") — there is no automatic date-based condition detection.
- `MPFM_*.xlsx`'s `BASE_UNICA_MES` sheet is the extraction source for MPFM data (not `HOURLYS`/`DAILYS` — their `Instrumento` column is bugged, see the design spec). `dp`/`gvf`/`wlr` come back `null` from this path — that column set doesn't exist in `BASE_UNICA_MES`.
- Numeric parsing from spreadsheet cells must use a `Number.isFinite`-based helper, never `Number(x) || null` — the latter silently turns a genuine `0` reading into `null`, which is wrong for a metrology app (a real zero water cut is not the same as "not measured").
- Portuguese (pt-BR) for all new user-facing strings.

---

### Task 1: Window date/time fields in the Campanha tab

**Files:**
- Modify: `apps/calibration/src/main.tsx`

**Interfaces:**
- Produces: no new interface — this reuses `CampanhaTab`'s existing `field`/`update` closure. Later tasks read `c.start`/`c.end`/`c.postStart`/`c.postEnd` from the same `Campaign` state this task lets the user edit.

- [ ] **Step 1: Add the four window fields to `CampanhaTab`**

Find:

```tsx
return <div className="page"><div className="title-row"><div><h1>Campanha</h1><p>Dados gerais, critérios e envelope operacional.</p></div></div><div className="form">{field('Campaign ID','id')}{field('Ativo / instalação','asset')}{field('Poço / Riser','well')}{field('TAG do MPFM','tag')}{field('Número de série','serial')}{field('Referência autorizada','reference')}{field('Pressão de bolha','pb','number','barg')}{field('Limite de desvio HC','hcLimit','number','fração')}{field('Limite de desvio total','totalLimit','number','fração')}{field('Timezone','timezone')}{field('Responsável técnico','responsible')}{field('Aprovador','approver')}{envField('Envelope de pressão','p','barg')}{envField('Envelope de temperatura','t','°C')}{envField('Envelope de dP','dp','kPa')}{envField('Envelope de GVF','gvf','%')}{envField('Envelope de WLR','wlr','%')}<label><span>Evidências completas</span><input type="checkbox" checked={c.evidence} onChange={e=>update('evidence',e.target.checked)}/></label><label><span>Aprovações formalizadas</span><input type="checkbox" checked={c.approvals} onChange={e=>update('approvals',e.target.checked)}/></label></div><button className="primary" onClick={save}><Save size={16}/>Salvar</button></div>
```

Replace with:

```tsx
return <div className="page"><div className="title-row"><div><h1>Campanha</h1><p>Dados gerais, critérios e envelope operacional.</p></div></div><div className="form">{field('Campaign ID','id')}{field('Ativo / instalação','asset')}{field('Poço / Riser','well')}{field('TAG do MPFM','tag')}{field('Número de série','serial')}{field('Referência autorizada','reference')}{field('Pressão de bolha','pb','number','barg')}{field('Limite de desvio HC','hcLimit','number','fração')}{field('Limite de desvio total','totalLimit','number','fração')}{field('Timezone','timezone')}{field('Responsável técnico','responsible')}{field('Aprovador','approver')}{field('Início da janela As-Found','start','datetime-local')}{field('Fim da janela As-Found','end','datetime-local')}{field('Início da janela Pós-K','postStart','datetime-local')}{field('Fim da janela Pós-K','postEnd','datetime-local')}{envField('Envelope de pressão','p','barg')}{envField('Envelope de temperatura','t','°C')}{envField('Envelope de dP','dp','kPa')}{envField('Envelope de GVF','gvf','%')}{envField('Envelope de WLR','wlr','%')}<label><span>Evidências completas</span><input type="checkbox" checked={c.evidence} onChange={e=>update('evidence',e.target.checked)}/></label><label><span>Aprovações formalizadas</span><input type="checkbox" checked={c.approvals} onChange={e=>update('approvals',e.target.checked)}/></label></div><button className="primary" onClick={save}><Save size={16}/>Salvar</button></div>
```

(`field`'s existing signature already handles any `type` string via `<input type={type}>`, and its `onChange` only special-cases `type==='number'` — for `'datetime-local'` it takes the plain-string branch, which is what `start`/`end`/`postStart`/`postEnd` (typed `string` on `Campaign`) need. No changes to the `field` helper itself.)

- [ ] **Step 2: Run the calibration app's own test suite**

Run: `cd apps/calibration && npm test`
Expected: `1 passed` — unchanged.

- [ ] **Step 3: Build**

```bash
cd apps/calibration
npm run build
cd ../..
```

Expected: exits 0.

- [ ] **Step 4: Copy the rebuilt output into `public/calibracao/`**

```bash
rm -rf public/calibracao
mkdir -p public/calibracao
cp -r apps/calibration/dist/. public/calibracao/
```

- [ ] **Step 5: Commit**

```bash
git add apps/calibration/src/main.tsx public/calibracao
git commit -m "feat: add As-Found/Pos-K window date fields to Campanha tab"
```

---

### Task 2: Extract `corsHeaders` into a shared module

**Files:**
- Create: `app/api/calibration/cors.ts`
- Modify: `app/api/calibration/route.ts`

**Interfaces:**
- Produces: `corsHeaders(request: Request): HeadersInit`, exported from `app/api/calibration/cors.ts`. Consumed by the existing `route.ts` (this task) and by Task 4's new `app/api/calibration/rows/route.ts`.

- [ ] **Step 1: Create the shared module**

Create `app/api/calibration/cors.ts`:

```ts
// Shared by every route under app/api/calibration/. Meant to be called
// cross-origin by the calibration app's own standalone dev server (a
// separate local Vite instance, not part of this repo's build), so only
// localhost origins get an Access-Control-Allow-Origin — never "*".
export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") ?? "";
  return /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ? { "Access-Control-Allow-Origin": origin } : {};
}
```

- [ ] **Step 2: Remove the local copy from `route.ts` and import the shared one**

Find:

```ts
import { env } from "cloudflare:workers";
import { loadCalibrationCampaign } from "../../../db/calibration";
import { saveCalibrationCampaign, createCalibrationCampaign, type CampaignInput } from "../../../db/calibration-write";

// This endpoint is meant to be called cross-origin by the standalone MPFM
// calibration app (a separate local dev server, not part of this repo), so
// only localhost origins get an Access-Control-Allow-Origin — never "*".
function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") ?? "";
  return /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ? { "Access-Control-Allow-Origin": origin } : {};
}
```

Replace with:

```ts
import { env } from "cloudflare:workers";
import { loadCalibrationCampaign } from "../../../db/calibration";
import { saveCalibrationCampaign, createCalibrationCampaign, type CampaignInput } from "../../../db/calibration-write";
import { corsHeaders } from "./cors";
```

- [ ] **Step 3: Build and test the root app**

```bash
npm run build
npm test
```

Expected: both exit 0 — pure refactor, no behavior change (verified by the existing 15 tests still passing).

- [ ] **Step 4: Commit**

```bash
git add app/api/calibration/cors.ts app/api/calibration/route.ts
git commit -m "refactor: extract corsHeaders into a shared module"
```

---

### Task 3: `saveCalibrationRows` — test-first

**Files:**
- Create: `db/calibration-rows-write.ts`
- Create: `tests/calibration-rows-write.test.mjs`

**Interfaces:**
- Consumes: `D1Batchable` from `db/portal-data.ts`.
- Produces: `saveCalibrationRows(db, campaignId, condition, mpfmRows, separatorRows)`, `MpfmRowInput`, `SeparatorRowInput` — all consumed by Task 4's route handler.

- [ ] **Step 1: Write the failing test file**

Create `tests/calibration-rows-write.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { loadCalibrationCampaign } from "../db/calibration.ts";
import { saveCalibrationRows } from "../db/calibration-rows-write.ts";

const migrations = [
  "../drizzle/0000_big_queen_noir.sql",
  "../drizzle/0001_real_source_data.sql",
  "../drizzle/0002_calibration_campaigns.sql",
  "../drizzle/0003_calibration_riser_p4_campaign.sql",
];

function toD1Shim(db) {
  return {
    prepare(sql) {
      const stmt = db.prepare(sql);
      return {
        bind(...values) {
          return {
            async all() {
              return { results: stmt.all(...values) };
            },
            async first() {
              return stmt.get(...values) ?? null;
            },
            async run() {
              const info = stmt.run(...values);
              return { success: true, meta: { last_row_id: Number(info.lastInsertRowid) } };
            },
          };
        },
      };
    },
    async batch(statements) {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
  };
}

async function seededDb() {
  const db = new DatabaseSync(":memory:");
  for (const path of migrations) {
    db.exec(await readFile(new URL(path, import.meta.url), "utf8"));
  }
  return db;
}

function mpfmRow(timestamp, oil) {
  return { timestamp, use: true, duration: 1, p: 116, t: 68, dp: null, gvf: null, wlr: null, oil, gas: 50, water: 0, oilCorr: null, gasCorr: null, waterCorr: null };
}

function separatorRow(timestamp, oilMass) {
  return { timestamp, use: true, durationH: 1, quality: "", pressureBarg: 85, temperatureC: 66, oilGvLineM3: 480, oilRhoCoriolisKgm3: 770, oilMassDirectT: oilMass, gasMassT: 87, waterMassT: 0, gasStdKsm3: 108, waterVolM3: 0, sourceRef: "SEP_Dados.xlsx" };
}

test("saveCalibrationRows returns not_found for an unknown campaign", async () => {
  const db = toD1Shim(await seededDb());
  const result = await saveCalibrationRows(db, "DOES-NOT-EXIST", "AS_FOUND", [], []);
  assert.deepEqual(result, { ok: false, reason: "not_found" });
});

test("inserts new MPFM and separator rows for a real campaign", async () => {
  const db = toD1Shim(await seededDb());
  const result = await saveCalibrationRows(
    db, "RVD-MPFM-COM-05-26", "AS_FOUND",
    [mpfmRow("2026-06-15T10:00:00", 340)],
    [separatorRow("2026-06-15T10:00:00", 341)],
  );
  assert.deepEqual(result, { ok: true, mpfmCount: 1, separatorCount: 1 });

  const campaign = await loadCalibrationCampaign(db, "RVD-MPFM-COM-05-26");
  const row = campaign.rows.find((r) => r.timestamp === "2026-06-15T10:00:00" && r.condition === "AS_FOUND");
  assert.ok(row, "expected the new MPFM row to be present");
  assert.equal(row.oil, 340);

  const sepRow = campaign.raw.separatorRows.find((r) => r.timestamp === "2026-06-15T10:00:00");
  assert.ok(sepRow, "expected the new separator row to be present");
  assert.equal(sepRow.oil_mass_direct_t, 341);
});

test("re-sending the same timestamp updates instead of duplicating", async () => {
  const db = toD1Shim(await seededDb());
  await saveCalibrationRows(db, "RVD-MPFM-COM-05-26", "AS_FOUND", [mpfmRow("2026-06-15T10:00:00", 340)], []);
  await saveCalibrationRows(db, "RVD-MPFM-COM-05-26", "AS_FOUND", [mpfmRow("2026-06-15T10:00:00", 999)], []);

  const campaign = await loadCalibrationCampaign(db, "RVD-MPFM-COM-05-26");
  const matching = campaign.rows.filter((r) => r.timestamp === "2026-06-15T10:00:00" && r.condition === "AS_FOUND");
  assert.equal(matching.length, 1, "must not duplicate the row on re-send");
  assert.equal(matching[0].oil, 999, "must update to the latest value");
});
```

- [ ] **Step 2: Run the test file to confirm it fails (module doesn't exist yet)**

Run: `node --test tests/calibration-rows-write.test.mjs`
Expected: FAIL — module-not-found error for `../db/calibration-rows-write.ts`.

- [ ] **Step 3: Implement `db/calibration-rows-write.ts`**

Create `db/calibration-rows-write.ts`:

```ts
/**
 * Writes extracted MPFM/separator readings to D1 for a given calibration
 * window (AS_FOUND or POST_K). Rows come from parsing the real production
 * Excel files client-side (apps/calibration/src/main.tsx) — this module
 * never fabricates or manually accepts hand-typed readings, only bulk
 * upserts of already-extracted rows. Upserting (not inserting) means
 * re-extracting the same window updates existing rows instead of
 * duplicating them, keyed by the same (campaign_id, condition, timestamp)
 * unique indexes db/schema.ts already defines.
 */

import type { D1Batchable } from "./portal-data";

export interface MpfmRowInput {
  timestamp: string;
  use: boolean;
  duration: number | null;
  p: number | null;
  t: number | null;
  dp: number | null;
  gvf: number | null;
  wlr: number | null;
  oil: number | null;
  gas: number | null;
  water: number | null;
  oilCorr: number | null;
  gasCorr: number | null;
  waterCorr: number | null;
}

export interface SeparatorRowInput {
  timestamp: string;
  use: boolean;
  durationH: number | null;
  quality: string;
  pressureBarg: number | null;
  temperatureC: number | null;
  oilGvLineM3: number | null;
  oilRhoCoriolisKgm3: number | null;
  oilMassDirectT: number | null;
  gasMassT: number | null;
  waterMassT: number | null;
  gasStdKsm3: number | null;
  waterVolM3: number | null;
  sourceRef: string;
}

const UPSERT_MPFM_ROW_SQL = `INSERT INTO calibration_mpfm_rows
  (campaign_id, condition, timestamp, use_flag, duration_h, pressure_barg, temperature_c, dp_kpa, gvf_pct, wlr_pct, oil_uncorr_t, gas_uncorr_t, water_uncorr_t, oil_corr_t, gas_corr_t, water_corr_t)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (campaign_id, condition, timestamp) DO UPDATE SET
    use_flag = excluded.use_flag, duration_h = excluded.duration_h,
    pressure_barg = excluded.pressure_barg, temperature_c = excluded.temperature_c,
    dp_kpa = excluded.dp_kpa, gvf_pct = excluded.gvf_pct, wlr_pct = excluded.wlr_pct,
    oil_uncorr_t = excluded.oil_uncorr_t, gas_uncorr_t = excluded.gas_uncorr_t, water_uncorr_t = excluded.water_uncorr_t,
    oil_corr_t = excluded.oil_corr_t, gas_corr_t = excluded.gas_corr_t, water_corr_t = excluded.water_corr_t`;

const UPSERT_SEPARATOR_ROW_SQL = `INSERT INTO calibration_separator_rows
  (campaign_id, condition, timestamp, use_flag, duration_h, quality, pressure_barg, temperature_c, oil_gv_line_m3, oil_rho_coriolis_kgm3, oil_mass_direct_t, gas_mass_t, water_mass_t, gas_std_ksm3, water_vol_m3, source_ref)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (campaign_id, condition, timestamp) DO UPDATE SET
    use_flag = excluded.use_flag, duration_h = excluded.duration_h, quality = excluded.quality,
    pressure_barg = excluded.pressure_barg, temperature_c = excluded.temperature_c,
    oil_gv_line_m3 = excluded.oil_gv_line_m3, oil_rho_coriolis_kgm3 = excluded.oil_rho_coriolis_kgm3,
    oil_mass_direct_t = excluded.oil_mass_direct_t, gas_mass_t = excluded.gas_mass_t, water_mass_t = excluded.water_mass_t,
    gas_std_ksm3 = excluded.gas_std_ksm3, water_vol_m3 = excluded.water_vol_m3, source_ref = excluded.source_ref`;

export async function saveCalibrationRows(
  db: D1Batchable,
  campaignId: string,
  condition: "AS_FOUND" | "POST_K",
  mpfmRows: MpfmRowInput[],
  separatorRows: SeparatorRowInput[],
): Promise<{ ok: true; mpfmCount: number; separatorCount: number } | { ok: false; reason: "not_found" }> {
  const existing = await db
    .prepare(`SELECT id FROM calibration_campaigns WHERE campaign_id = ?`)
    .bind(campaignId)
    .first<{ id: number }>();
  if (!existing) return { ok: false, reason: "not_found" };
  const id = existing.id;

  const statements = [
    ...mpfmRows.map((row) =>
      db.prepare(UPSERT_MPFM_ROW_SQL).bind(
        id, condition, row.timestamp, row.use ? 1 : 0, row.duration,
        row.p, row.t, row.dp, row.gvf, row.wlr,
        row.oil, row.gas, row.water, row.oilCorr, row.gasCorr, row.waterCorr,
      ),
    ),
    ...separatorRows.map((row) =>
      db.prepare(UPSERT_SEPARATOR_ROW_SQL).bind(
        id, condition, row.timestamp, row.use ? 1 : 0, row.durationH, row.quality,
        row.pressureBarg, row.temperatureC, row.oilGvLineM3, row.oilRhoCoriolisKgm3,
        row.oilMassDirectT, row.gasMassT, row.waterMassT, row.gasStdKsm3, row.waterVolM3, row.sourceRef,
      ),
    ),
  ];
  if (statements.length > 0) await db.batch(statements);

  return { ok: true, mpfmCount: mpfmRows.length, separatorCount: separatorRows.length };
}
```

- [ ] **Step 4: Run the test file again to confirm all 3 tests pass**

Run: `node --test tests/calibration-rows-write.test.mjs`
Expected: PASS — 3 tests, 0 failures.

- [ ] **Step 5: Run the full root test suite**

Run: `npm test`
Expected: PASS — exit code 0 (18 tests: 15 pre-existing + 3 new).

- [ ] **Step 6: Commit**

```bash
git add db/calibration-rows-write.ts tests/calibration-rows-write.test.mjs
git commit -m "feat: add saveCalibrationRows to upsert extracted MPFM/separator readings"
```

---

### Task 4: `PUT /api/calibration/rows` route handler

**Files:**
- Create: `app/api/calibration/rows/route.ts`

**Interfaces:**
- Consumes: `saveCalibrationRows`, `MpfmRowInput`, `SeparatorRowInput` (Task 3); `corsHeaders` (Task 2); `loadCalibrationCampaign` (existing).
- Produces: the live endpoint, consumed by Task 6's frontend wiring.

- [ ] **Step 1: Create the route file**

Create `app/api/calibration/rows/route.ts`:

```ts
import { env } from "cloudflare:workers";
import { loadCalibrationCampaign } from "../../../../db/calibration";
import { saveCalibrationRows, type MpfmRowInput, type SeparatorRowInput } from "../../../../db/calibration-rows-write";
import { corsHeaders } from "../cors";

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      "Access-Control-Allow-Methods": "PUT",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function parseMpfmRow(value: unknown): MpfmRowInput | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;
  if (!isString(r.timestamp) || typeof r.use !== "boolean" || !isString(r.quality)) return null;
  const numbers = ["duration", "p", "t", "dp", "gvf", "wlr", "oil", "gas", "water", "oilCorr", "gasCorr", "waterCorr"] as const;
  for (const key of numbers) if (!isNumberOrNull(r[key])) return null;
  return {
    timestamp: r.timestamp,
    use: r.use as boolean,
    duration: r.duration as number | null,
    quality: r.quality,
    p: r.p as number | null,
    t: r.t as number | null,
    dp: r.dp as number | null,
    gvf: r.gvf as number | null,
    wlr: r.wlr as number | null,
    oil: r.oil as number | null,
    gas: r.gas as number | null,
    water: r.water as number | null,
    oilCorr: r.oilCorr as number | null,
    gasCorr: r.gasCorr as number | null,
    waterCorr: r.waterCorr as number | null,
  };
}

function parseSeparatorRow(value: unknown): SeparatorRowInput | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;
  if (!isString(r.timestamp) || typeof r.use !== "boolean" || !isString(r.quality) || !isString(r.sourceRef)) return null;
  const numbers = ["durationH", "pressureBarg", "temperatureC", "oilGvLineM3", "oilRhoCoriolisKgm3", "oilMassDirectT", "gasMassT", "waterMassT", "gasStdKsm3", "waterVolM3"] as const;
  for (const key of numbers) if (!isNumberOrNull(r[key])) return null;
  return {
    timestamp: r.timestamp,
    use: r.use as boolean,
    durationH: r.durationH as number | null,
    quality: r.quality,
    pressureBarg: r.pressureBarg as number | null,
    temperatureC: r.temperatureC as number | null,
    oilGvLineM3: r.oilGvLineM3 as number | null,
    oilRhoCoriolisKgm3: r.oilRhoCoriolisKgm3 as number | null,
    oilMassDirectT: r.oilMassDirectT as number | null,
    gasMassT: r.gasMassT as number | null,
    waterMassT: r.waterMassT as number | null,
    gasStdKsm3: r.gasStdKsm3 as number | null,
    waterVolM3: r.waterVolM3 as number | null,
    sourceRef: r.sourceRef,
  };
}

export async function PUT(request: Request) {
  const headers = corsHeaders(request);
  try {
    if (!env.DB) {
      return Response.json({ status: "unavailable", error: "Base D1 não vinculada." }, { status: 503, headers });
    }

    const url = new URL(request.url);
    const campaignId = url.searchParams.get("campaignId");
    const condition = url.searchParams.get("condition");
    if (!campaignId) {
      return Response.json({ status: "error", error: "Parâmetro campaignId é obrigatório." }, { status: 400, headers });
    }
    if (condition !== "AS_FOUND" && condition !== "POST_K") {
      return Response.json({ status: "error", error: "Parâmetro condition deve ser AS_FOUND ou POST_K." }, { status: 400, headers });
    }

    const body = await request.json().catch(() => null);
    if (typeof body !== "object" || body === null || !Array.isArray((body as Record<string, unknown>).mpfmRows) || !Array.isArray((body as Record<string, unknown>).separatorRows)) {
      return Response.json({ status: "error", error: "Corpo da requisição inválido." }, { status: 400, headers });
    }
    const rawMpfm = (body as Record<string, unknown>).mpfmRows as unknown[];
    const rawSeparator = (body as Record<string, unknown>).separatorRows as unknown[];
    const mpfmRows = rawMpfm.map(parseMpfmRow);
    const separatorRows = rawSeparator.map(parseSeparatorRow);
    if (mpfmRows.some((row) => row === null) || separatorRows.some((row) => row === null)) {
      return Response.json({ status: "error", error: "Uma ou mais linhas têm formato inválido." }, { status: 400, headers });
    }

    const result = await saveCalibrationRows(env.DB, campaignId, condition, mpfmRows as MpfmRowInput[], separatorRows as SeparatorRowInput[]);
    if (!result.ok) {
      return Response.json({ status: "error", error: `Campanha não encontrada: ${campaignId}` }, { status: 404, headers });
    }

    const campaign = await loadCalibrationCampaign(env.DB, campaignId);
    return Response.json({ status: "ok", mpfmCount: result.mpfmCount, separatorCount: result.separatorCount, campaign }, { headers });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    const message = /no such table|D1_ERROR/i.test(detail)
      ? "A base real ainda não foi inicializada neste ambiente. A migração será aplicada na publicação."
      : "Falha ao gravar as linhas na base real.";
    return Response.json({ status: "error", error: message }, { status: 500, headers });
  }
}
```

- [ ] **Step 2: Build and test the root app**

```bash
npm run build
npm test
```

Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/api/calibration/rows/route.ts
git commit -m "feat: add PUT /api/calibration/rows endpoint"
```

---

### Task 5: Frontend Excel window parsers

**Files:**
- Modify: `apps/calibration/src/main.tsx`

**Interfaces:**
- Produces: `parseMpfmWindow(file, tag, start, end): Promise<MpfmExtractRow[]>` and `parseSeparatorWindow(file, start, end): Promise<SeparatorExtractRow[]>`, consumed by Task 6's `ImportacaoTab`.

- [ ] **Step 1: Add the `toNum` helper, right after `numOrDash`**

Find:

```tsx
const numOrDash=(n:number|null,d=2)=>n==null?'—':fmt(n,d);
```

Replace with:

```tsx
const numOrDash=(n:number|null,d=2)=>n==null?'—':fmt(n,d);
const toNum=(v:unknown):number|null=>{const n=Number(v);return Number.isFinite(n)?n:null};
```

(`toNum` exists specifically to avoid the `Number(x)||null` footgun — a genuine `0` reading, common for water cut on a dry well, would otherwise silently become `null` since `0` is falsy in JS.)

- [ ] **Step 2: Add the two extraction row types, right after `LabResult`**

Find:

```tsx
type LabResult={sample_id:string,use_flag:number,sampled_at:string,sample_type:string,bsw_pct:number|null,rho_oil_std_kgm3:number|null,rho_gas_std_kgsm3:number|null,rho_water_std_kgm3:number|null,fe:number|null,rs:number|null,method:string,report_id:string,status:string};
```

Replace with:

```tsx
type LabResult={sample_id:string,use_flag:number,sampled_at:string,sample_type:string,bsw_pct:number|null,rho_oil_std_kgm3:number|null,rho_gas_std_kgsm3:number|null,rho_water_std_kgm3:number|null,fe:number|null,rs:number|null,method:string,report_id:string,status:string};
type MpfmExtractRow={timestamp:string,use:boolean,duration:number|null,quality:string,p:number|null,t:number|null,dp:number|null,gvf:number|null,wlr:number|null,oil:number|null,gas:number|null,water:number|null,oilCorr:number|null,gasCorr:number|null,waterCorr:number|null};
type SeparatorExtractRow={timestamp:string,use:boolean,durationH:number|null,quality:string,pressureBarg:number|null,temperatureC:number|null,oilGvLineM3:number|null,oilRhoCoriolisKgm3:number|null,oilMassDirectT:number|null,gasMassT:number|null,waterMassT:number|null,gasStdKsm3:number|null,waterVolM3:number|null,sourceRef:string};
```

(These are the frontend's own copies of `db/calibration-rows-write.ts`'s `MpfmRowInput`/`SeparatorRowInput` shapes — named differently to avoid clashing with the already-existing `SeparatorRow` type, which represents the *read* shape from `campaign.raw.separatorRows`, not this extraction/write shape. Frontend and backend are separate bundles/deployables, so this duplication is unavoidable — same reasoning as `Campaign`/`CampaignInput` already being separately declared on each side.)

- [ ] **Step 3: Add the two parsing functions, right before `function App(){`**

Find:

```tsx
function App(){
```

Insert immediately before that line:

```tsx
async function parseMpfmWindow(file:File,tag:string,start:string,end:string):Promise<MpfmExtractRow[]>{
 const ab=await file.arrayBuffer();
 const wb=XLSX.read(ab,{cellDates:true});
 const ws=wb.Sheets['BASE_UNICA_MES'];
 if(!ws) return [];
 const startTime=start?new Date(start).getTime():-Infinity;
 const endTime=end?new Date(end).getTime():Infinity;
 const out:MpfmExtractRow[]=[];
 for(const r of XLSX.utils.sheet_to_json<any[]>(ws,{header:1,raw:true})){
  if(r[3]!=='Hourly'||r[13]!==tag) continue;
  const date=r[1],hour=r[2];
  if(!date||!hour) continue;
  const timestamp=`${date}T${hour}:00`;
  const t=new Date(timestamp).getTime();
  if(Number.isNaN(t)||t<startTime||t>endTime) continue;
  out.push({timestamp,use:true,duration:1,quality:'',p:toNum(r[45]),t:toNum(r[46]),dp:null,gvf:null,wlr:null,oil:toNum(r[16]),gas:toNum(r[15]),water:toNum(r[18]),oilCorr:toNum(r[21]),gasCorr:toNum(r[20]),waterCorr:toNum(r[23])});
 }
 return out;
}
async function parseSeparatorWindow(file:File,start:string,end:string):Promise<SeparatorExtractRow[]>{
 const ab=await file.arrayBuffer();
 const wb=XLSX.read(ab,{cellDates:true});
 const startTime=start?new Date(start).getTime():-Infinity;
 const endTime=end?new Date(end).getTime():Infinity;
 const readings:Record<string,{p:number|null,t:number|null,oilGv:number|null,oilRho:number|null,oilMass:number|null,gasMass:number|null,gasStd:number|null,waterMass:number|null,waterVol:number|null}>={};
 const ensure=(timestamp:string)=>readings[timestamp]??(readings[timestamp]={p:null,t:null,oilGv:null,oilRho:null,oilMass:null,gasMass:null,gasStd:null,waterMass:null,waterVol:null});
 const eachRow=(sheetName:string,fn:(r:any[],timestamp:string)=>void)=>{
  const ws=wb.Sheets[sheetName];
  if(!ws) return;
  let currentDay='';
  for(const r of XLSX.utils.sheet_to_json<any[]>(ws,{header:1,raw:true})){
   const marker=String(r[2]??'');
   const dayMatch=/Data:\s*(\d{4}-\d{2}-\d{2})/.exec(marker);
   if(dayMatch){currentDay=dayMatch[1];continue}
   if(!currentDay||marker==='DAY') continue;
   const hourNum=Number(marker);
   if(!Number.isInteger(hourNum)||hourNum<1||hourNum>24) continue;
   const timestamp=`${currentDay}T${String(hourNum-1).padStart(2,'0')}:00`;
   const t=new Date(timestamp).getTime();
   if(Number.isNaN(t)||t<startTime||t>endTime) continue;
   fn(r,timestamp);
  }
 };
 eachRow('separador oleo',(r,timestamp)=>{const e=ensure(timestamp);e.p=toNum(r[4]);e.t=toNum(r[5]);e.oilGv=toNum(r[9]);e.oilRho=toNum(r[17]);e.oilMass=toNum(r[11])});
 eachRow('separador gas',(r,timestamp)=>{const e=ensure(timestamp);e.gasMass=toNum(r[9]);const std=toNum(r[8]);e.gasStd=std!=null?std/1000:null});
 eachRow('separador agua',(r,timestamp)=>{const e=ensure(timestamp);e.waterMass=toNum(r[10]);e.waterVol=toNum(r[8])});
 return Object.entries(readings).map(([timestamp,v])=>({timestamp,use:true,durationH:1,quality:'',pressureBarg:v.p,temperatureC:v.t,oilGvLineM3:v.oilGv,oilRhoCoriolisKgm3:v.oilRho,oilMassDirectT:v.oilMass,gasMassT:v.gasMass,waterMassT:v.waterMass,gasStdKsm3:v.gasStd,waterVolM3:v.waterVol,sourceRef:file.name}));
}
function App(){
```

(`parseMpfmWindow` filters `BASE_UNICA_MES` by `Instrumento` — column index 13 — matching the campaign's `tag`, and `Granularity==='Hourly'` — column index 3. Neither function needs an explicit header-row skip: the header row's own text values ('Granularity', 'Hora', etc.) naturally fail the `==='Hourly'`/tag-match/`Data:`-regex/`'DAY'` checks, so it's filtered out for free. `parseSeparatorWindow` treats hour label `'1'`–`'24'` as hour-*ending*, i.e. `'1'` → clock hour `00:00`, `'24'` → `23:00` — see the design spec's documented assumption if this needs correcting for a different meter convention.)

- [ ] **Step 4: Run the calibration app's own test suite**

Run: `cd apps/calibration && npm test`
Expected: `1 passed` — unchanged (`engine.test.ts` only exercises `calculate()`, untouched by this task).

- [ ] **Step 5: Build**

```bash
cd apps/calibration
npm run build
cd ../..
```

Expected: exits 0 (this also serves as a TypeScript sanity check on the two new functions, since `vite build` will fail on a type error).

- [ ] **Step 6: Copy the rebuilt output into `public/calibracao/`**

```bash
rm -rf public/calibracao
mkdir -p public/calibracao
cp -r apps/calibration/dist/. public/calibracao/
```

- [ ] **Step 7: Commit**

```bash
git add apps/calibration/src/main.tsx public/calibracao
git commit -m "feat: add client-side MPFM/separator Excel window parsers"
```

---

### Task 6: Wire the Importação tab to extract and upload

**Files:**
- Modify: `apps/calibration/src/main.tsx`

**Interfaces:**
- Consumes: `parseMpfmWindow`/`parseSeparatorWindow` (Task 5); `PUT /api/calibration/rows` (Task 4), via same-origin relative `fetch()`.
- Produces: no new interface — this is the last piece of the extraction flow.

- [ ] **Step 1: Replace `ImportacaoTab` with the file-upload version**

Find:

```tsx
function ImportacaoTab({fileRef}:{fileRef:React.RefObject<HTMLInputElement>}){
 return <div className="page"><div className="title-row"><div><h1>Importação</h1><p>Carrega uma nova campanha a partir do Excel de calibração.</p></div></div><div className="form"><div className="validation"><CheckCircle2/><span><b>Formato aceito</b><small>Excel (.xlsx/.xls) com as abas "01_CAMPANHA" e "IN_01_MPFM" — mesmo modelo do botão "Importar" no topo da tela.</small></span></div><button className="primary" onClick={()=>fileRef.current?.click()}><Upload size={16}/>Selecionar arquivo</button></div></div>
}
```

Replace with:

```tsx
function ImportacaoTab({fileRef,c,onRowsSaved,flash}:{fileRef:React.RefObject<HTMLInputElement>,c:Campaign,onRowsSaved:(campaign:Campaign)=>void,flash:(s:string)=>void}){
 const [mpfmFile,setMpfmFile]=useState<File|null>(null);
 const [sepFile,setSepFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const carregar=async(condition:'AS_FOUND'|'POST_K')=>{
  const start=condition==='AS_FOUND'?c.start:c.postStart;
  const end=condition==='AS_FOUND'?c.end:c.postEnd;
  if(!start||!end){setError('Preencha a janela de datas na aba Campanha antes de carregar.');return}
  setBusy(true);setError('');
  try{
   const mpfmRows=mpfmFile?await parseMpfmWindow(mpfmFile,c.tag,start,end):[];
   const separatorRows=sepFile?await parseSeparatorWindow(sepFile,start,end):[];
   const res=await fetch(`/api/calibration/rows?campaignId=${encodeURIComponent(c.id)}&condition=${condition}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({mpfmRows,separatorRows})});
   const data=await res.json();
   if(!res.ok||data.status!=='ok'){setError(data.error||'Falha ao carregar linhas.');setBusy(false);return}
   flash(`Carregado: ${data.mpfmCount} linhas MPFM, ${data.separatorCount} linhas de separador.`);
   onRowsSaved(data.campaign);
  }catch{setError('Base real indisponível — não foi possível carregar as linhas.')}
  setBusy(false);
 };
 return <div className="page"><div className="title-row"><div><h1>Importação</h1><p>Carrega uma nova campanha a partir do Excel de calibração.</p></div></div><div className="form"><div className="validation"><CheckCircle2/><span><b>Formato aceito</b><small>Excel (.xlsx/.xls) com as abas "01_CAMPANHA" e "IN_01_MPFM" — mesmo modelo do botão "Importar" no topo da tela.</small></span></div><button className="primary" onClick={()=>fileRef.current?.click()}><Upload size={16}/>Selecionar arquivo</button></div><div className="form"><label><span>Excel MPFM (mensal, ex: MPFM_JUN_2026.xlsx)</span><div><input type="file" accept=".xlsx,.xls" onChange={e=>setMpfmFile(e.target.files?.[0]??null)}/></div></label><label><span>Excel Separador (período, ex: SEP_Dados.xlsx)</span><div><input type="file" accept=".xlsx,.xls" onChange={e=>setSepFile(e.target.files?.[0]??null)}/></div></label>{error&&<p className="form-error">{error}</p>}<button className="primary" disabled={busy} onClick={()=>carregar('AS_FOUND')}><Download size={16}/>Carregar janela As-Found</button><button className="primary" disabled={busy} onClick={()=>carregar('POST_K')}><Download size={16}/>Carregar janela Pós-K</button></div></div>
}
```

- [ ] **Step 2: Pass the new props at the call site**

Find:

```tsx
active==='Importação'?<ImportacaoTab fileRef={fileRef}/>:
```

Replace with:

```tsx
active==='Importação'?<ImportacaoTab fileRef={fileRef} c={c} onRowsSaved={updated=>{setC(updated);localStorage.setItem('mpfm-campaign',JSON.stringify(updated))}} flash={flash}/>:
```

- [ ] **Step 3: Run the calibration app's own test suite**

Run: `cd apps/calibration && npm test`
Expected: `1 passed` — unchanged.

- [ ] **Step 4: Build**

```bash
cd apps/calibration
npm run build
cd ../..
```

Expected: exits 0.

- [ ] **Step 5: Copy the rebuilt output into `public/calibracao/`**

```bash
rm -rf public/calibracao
mkdir -p public/calibracao
cp -r apps/calibration/dist/. public/calibracao/
```

- [ ] **Step 6: Commit**

```bash
git add apps/calibration/src/main.tsx public/calibracao
git commit -m "feat: wire Importacao tab to extract and upload MPFM/separator windows"
```

---

### Task 7: End-to-end verification with the real Excel files, and docs

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything from Tasks 1-6 running together, plus the real `MPFM_JUN_2026.xlsx`/`SEP_Dados.xlsx` files already sitting (gitignored, untracked) at the repo root.
- Produces: confirmation the phase goal is met against real data, plus accurate docs.

- [ ] **Step 1: Update `CLAUDE.md`'s Calibration domain section**

Find the sentence added in Phase 4 about campaign creation:

```markdown
`scripts/
import-mpfm-calibration.py`'s job. `rows` (MPFM/
separator readings) and everything under `campaign.raw` stay read-only/
import-only. The Metrolog app's "Salvar" button calls this endpoint (same
origin as of Phase 1) in addition to its existing `localStorage` save. As of Phase 4 (2026-07-14), `POST
/api/calibration` (`createCalibrationCampaign`) creates a brand-new campaign
from the app itself, via a "Solicitar calibração" modal — `scripts/
import-mpfm-calibration.py` remains available for bulk/offline creation but
is no longer the only path.
```

Replace with:

```markdown
`scripts/
import-mpfm-calibration.py`'s job. Everything under `campaign.raw` stays
read-only/import-only. The Metrolog app's "Salvar" button calls this
endpoint (same origin as of Phase 1) in addition to its existing
`localStorage` save. As of Phase 4 (2026-07-14), `POST
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
in place instead of duplicating rows.
```

- [ ] **Step 2: Start the root dev server**

```bash
export WRANGLER_LOG_PATH=.wrangler/wrangler.log
npx vite &
sleep 6
```

- [ ] **Step 3: Confirm the seeded campaign already has a usable As-Found window**

```bash
curl -s "http://localhost:5173/api/calibration?campaignId=RVD-MPFM-COM-05-26" | grep -o '"start":"[^"]*"\|"end":"[^"]*"'
```

Expected: `"start":"2026-06-29T12:00"` and `"end":"2026-06-30T12:00"` — this window already exists in the seeded campaign (Task 1 just gave it a UI, it didn't need to be re-entered), and it falls inside `MPFM_JUN_2026.xlsx`'s June coverage.

- [ ] **Step 4: Confirm a real-file extraction round-trip via the HTTP endpoint**

This step requires `MPFM_JUN_2026.xlsx` at the repo root (already present, gitignored, untracked — do not commit it). Use a small Node script to read it, extract, and PUT, mirroring exactly what the browser-side `parseMpfmWindow` does:

```bash
node --input-type=module -e "
import { readFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
const buf = await readFile('MPFM_JUN_2026.xlsx');
const wb = XLSX.read(buf, { cellDates: true });
const ws = wb.Sheets['BASE_UNICA_MES'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
const start = new Date('2026-06-29T12:00').getTime();
const end = new Date('2026-06-30T12:00').getTime();
const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const out = [];
for (const r of rows) {
  if (r[3] !== 'Hourly' || r[13] !== '13FT0317') continue;
  const timestamp = \`\${r[1]}T\${r[2]}:00\`;
  const t = new Date(timestamp).getTime();
  if (Number.isNaN(t) || t < start || t > end) continue;
  out.push({ timestamp, use: true, duration: 1, p: toNum(r[45]), t: toNum(r[46]), dp: null, gvf: null, wlr: null, oil: toNum(r[16]), gas: toNum(r[15]), water: toNum(r[18]), oilCorr: toNum(r[21]), gasCorr: toNum(r[20]), waterCorr: toNum(r[23]) });
}
console.log('extracted rows:', out.length);
const res = await fetch('http://localhost:5173/api/calibration/rows?campaignId=RVD-MPFM-COM-05-26&condition=AS_FOUND', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mpfmRows: out, separatorRows: [] }),
});
console.log(res.status, await res.text());
"
```

Expected: `extracted rows:` prints a number greater than 0 (the real June file has hourly `13FT0317` rows inside the 2026-06-29T12:00–2026-06-30T12:00 window), and the `PUT` response is `200` with `"status":"ok"` and matching `"mpfmCount"`.

- [ ] **Step 5: Confirm 404 for an unknown campaign and 400 for a bad `condition`**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PUT "http://localhost:5173/api/calibration/rows?campaignId=DOES-NOT-EXIST&condition=AS_FOUND" -H "Content-Type: application/json" --data-binary '{"mpfmRows":[],"separatorRows":[]}'
curl -s -o /dev/null -w "%{http_code}\n" -X PUT "http://localhost:5173/api/calibration/rows?campaignId=RVD-MPFM-COM-05-26&condition=BOGUS" -H "Content-Type: application/json" --data-binary '{"mpfmRows":[],"separatorRows":[]}'
```

Expected: `404` then `400`.

- [ ] **Step 6: Confirm the live UI end-to-end (manual, via a visual tool the orchestrator has and this dispatch may not)**

Navigate to `/calibracao/`, open the Campanha tab, confirm the four new window fields show the existing dates. Open the Importação tab, select `MPFM_JUN_2026.xlsx` as the MPFM file (leave separator blank if `SEP_Dados.xlsx`'s date range doesn't overlap the campaign's window — check first), click "Carregar janela As-Found", confirm a success toast appears and the MPFM tab now shows rows sourced from the real file.

- [ ] **Step 7: Stop the dev server**

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

- [ ] **Step 8: Run both test suites once more**

```bash
npm test
cd apps/calibration && npm test && cd ../..
```

Expected: both exit 0.

- [ ] **Step 9: Commit the docs update**

```bash
git add CLAUDE.md
git commit -m "docs: reflect the MPFM/separator window extraction landing in Phase 5"
```

- [ ] **Step 10: Final status check**

```bash
git status -sb
```

Expected: clean except for the branch-tracking line and the three untracked `.xlsx` files at the repo root (intentionally never committed).
