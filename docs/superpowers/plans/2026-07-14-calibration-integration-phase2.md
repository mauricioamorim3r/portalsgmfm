# Fase 2 — API de escrita para o módulo de calibração Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `PUT /api/calibration?campaignId=<id>` so the calibration campaign (scalar fields, envelope, PVT, K-factors, uncertainty, evidence/approvals — the exact shape `GET` already returns, minus `rows`/`raw`) can be persisted to D1, and wire the Metrolog app's existing "Salvar" button to call it (keeping `localStorage` as a fallback).

**Architecture:** A new `db/calibration-write.ts` exposes `saveCalibrationCampaign(db, campaignId, input)`, using D1's `.batch()` for atomic multi-table writes (campaign row + PVT/K/uncertainty upserts), following the exact same `D1Queryable`-shaped testability pattern as the existing `db/calibration.ts` read path. The route handler validates the request body manually (matching the existing handler's style — no new validation library) before calling it. The frontend calls the new endpoint with a same-origin relative `fetch()` (same origin as of Phase 1, since the calibration app is served from `public/calibracao/` on the same domain as `app/api/calibration`).

**Tech Stack:** TypeScript, D1 (`.batch()` for atomic writes), `node:sqlite` (existing test double pattern), Vitest (unchanged in `apps/calibration`), `node:test` (root).

## Global Constraints

- Body shape is exactly what `GET /api/calibration?campaignId=` already returns under `campaign`, minus `rows` and `raw` — those stay read-only/import-only, untouched by this endpoint.
- The endpoint only UPDATEs an existing campaign — it never creates one. Campaign creation stays exclusive to `scripts/import-mpfm-calibration.py`. Not found → `404`.
- Writes touch ONLY the columns the `Campaign` type carries. Every other column (`eos_model`, `input_*`, `pb_barg`/`loaded_at`/`responded_at` on PVT records; `k_calculated`/`system`/`config_version`/`status`/`notes` on K applications except where explicitly listed; `u_mpfm_total_pp`/`u_ref_total_pp`/`k_mpfm`/`k_ref`/`source_version`/`status` on uncertainty; the `HC_DIAGNÓSTICO` K-application row) must retain its existing value — never overwritten, never nulled.
- Only the `'ÓLEO'` K-application row receives `applied_at`/`responsible`/`evidence_id` (from `k.date`/`k.responsible`/`k.evidence`) — `'GÁS'` and `'ÁGUA'` rows only get `k_approved`/`k_applied`.
- No new validation library (no Zod) — manual validation, matching the existing `GET` handler's style.
- CORS stays the same localhost/127.0.0.1-only regex policy (never `*`) — extended only to also allow `PUT` and the `Content-Type` header on preflight.
- Portuguese (pt-BR) for all new user-facing strings (error messages, toast text).

---

### Task 1: Add a batchable D1 type

**Files:**
- Modify: `db/portal-data.ts`

**Interfaces:**
- Produces: `D1Batchable` interface (extends the existing `D1Queryable`), consumed by Task 2's `saveCalibrationCampaign`.

- [ ] **Step 1: Add the new interface**

In `db/portal-data.ts`, immediately after the existing `D1Queryable` interface (after line 18, `export interface D1Queryable { prepare(sql: string): D1Statement; }`), add:

```ts
export interface D1Batchable extends D1Queryable {
  batch<T = unknown>(statements: unknown[]): Promise<T[]>;
}
```

- [ ] **Step 2: Verify existing code still compiles**

Run: `npm run build`
Expected: exits 0 (this is a purely additive type change — nothing existing references `D1Batchable` yet).

- [ ] **Step 3: Commit**

```bash
git add db/portal-data.ts
git commit -m "feat: add D1Batchable type for multi-statement atomic writes"
```

---

### Task 2: `saveCalibrationCampaign` — the write function, test-first

**Files:**
- Create: `db/calibration-write.ts`
- Create: `tests/calibration-write.test.mjs`

**Interfaces:**
- Consumes: `D1Batchable` from `db/portal-data.ts` (Task 1); `loadCalibrationCampaign` from `db/calibration.ts` (existing, read-only, used by the test file to verify round-trips).
- Produces: `saveCalibrationCampaign(db: D1Batchable, campaignId: string, input: CampaignInput): Promise<{ ok: true } | { ok: false; reason: "not_found" }>` and the exported `CampaignInput` type — both consumed by Task 3's route handler.

- [ ] **Step 1: Write the test file (it will fail — the implementation doesn't exist yet)**

Create `tests/calibration-write.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { loadCalibrationCampaign } from "../db/calibration.ts";
import { saveCalibrationCampaign } from "../db/calibration-write.ts";

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
              stmt.run(...values);
              return { success: true };
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

// Builds a valid CampaignInput from whatever loadCalibrationCampaign returns,
// stripping the read-only rows/raw — mirrors exactly what the real frontend
// does (fetch, tweak some fields, PUT the same shape back).
function toInput(campaign) {
  const { rows, raw, ...input } = campaign;
  return input;
}

test("saveCalibrationCampaign returns not_found for an unknown campaign", async () => {
  const db = toD1Shim(await seededDb());
  const campaign = await loadCalibrationCampaign(db, "RVD-MPFM-COM-05-26");
  const result = await saveCalibrationCampaign(db, "DOES-NOT-EXIST", toInput(campaign));
  assert.deepEqual(result, { ok: false, reason: "not_found" });
});

test("persists scalar field edits without disturbing rows/raw", async () => {
  const db = toD1Shim(await seededDb());
  const before = await loadCalibrationCampaign(db, "RVD-MPFM-COM-05-26");
  const input = toInput(before);
  input.responsible = "Nova Responsável";
  input.hcLimit = 0.12;

  const result = await saveCalibrationCampaign(db, "RVD-MPFM-COM-05-26", input);
  assert.deepEqual(result, { ok: true });

  const after = await loadCalibrationCampaign(db, "RVD-MPFM-COM-05-26");
  assert.equal(after.responsible, "Nova Responsável");
  assert.equal(after.hcLimit, 0.12);
  // Untouched by this write — still exactly what the import pipeline seeded.
  assert.equal(after.rows.length, 48);
  assert.equal(after.raw.separatorRows.length, 48);
  assert.equal(after.raw.labResults.length, 3);
});

test("upserts envelope, PVT, K and uncertainty for fields that started null/empty", async () => {
  const db = toD1Shim(await seededDb());
  const before = await loadCalibrationCampaign(db, "RVD-MPFM-COM-05-26");
  assert.deepEqual(before.envelope.p, [null, null]); // confirms the starting state this test exercises

  const input = toInput(before);
  input.envelope = { p: [100, 200], t: [10, 90], dp: [0, 100], gvf: [0, 100], wlr: [0, 100] };
  input.pvt = { ...input.pvt, file: "pvt-2026.pdf", hash: "abc123", approver: "Nova PVT Approver" };
  input.k.oilApproved = 1.111;
  input.uncertainty.asMpfm = 4.5;

  const result = await saveCalibrationCampaign(db, "RVD-MPFM-COM-05-26", input);
  assert.deepEqual(result, { ok: true });

  const after = await loadCalibrationCampaign(db, "RVD-MPFM-COM-05-26");
  assert.deepEqual(after.envelope.p, [100, 200]);
  assert.deepEqual(after.envelope.wlr, [0, 100]);
  assert.equal(after.pvt.file, "pvt-2026.pdf");
  assert.equal(after.pvt.hash, "abc123");
  assert.equal(after.pvt.approver, "Nova PVT Approver");
  assert.equal(after.k.oilApproved, 1.111);
  assert.equal(after.uncertainty.asMpfm, 4.5);
});

test("only the ÓLEO K-application row's applied_at/responsible/evidence change; GÁS/ÁGUA and HC_DIAGNÓSTICO stay untouched", async () => {
  const db = toD1Shim(await seededDb());
  const before = await loadCalibrationCampaign(db, "RVD-MPFM-COM-05-26");
  const gasBefore = before.raw.kApplications.find((row) => row.phase === "GÁS");
  const hcBefore = before.raw.kApplications.find((row) => row.phase === "HC_DIAGNÓSTICO");

  const input = toInput(before);
  input.k.oilApproved = 1.2;
  input.k.gasApproved = 1.3;
  input.k.waterApproved = 1.4;
  input.k.date = "2026-08-01T00:00";
  input.k.responsible = "Novo Responsável K";
  input.k.evidence = "Nova evidência";

  const result = await saveCalibrationCampaign(db, "RVD-MPFM-COM-05-26", input);
  assert.deepEqual(result, { ok: true });

  const after = await loadCalibrationCampaign(db, "RVD-MPFM-COM-05-26");
  assert.equal(after.k.oilApproved, 1.2);
  assert.equal(after.k.gasApproved, 1.3);
  assert.equal(after.k.waterApproved, 1.4);
  assert.equal(after.k.responsible, "Novo Responsável K");

  const gasAfter = after.raw.kApplications.find((row) => row.phase === "GÁS");
  assert.equal(gasAfter.k_approved, 1.3); // did change
  assert.equal(gasAfter.applied_at, gasBefore.applied_at); // untouched
  assert.equal(gasAfter.status, gasBefore.status); // untouched

  const hcAfter = after.raw.kApplications.find((row) => row.phase === "HC_DIAGNÓSTICO");
  assert.deepEqual(hcAfter, hcBefore); // entirely untouched — not in scope for this write
});

test("supports renaming the campaign_id", async () => {
  const db = toD1Shim(await seededDb());
  const before = await loadCalibrationCampaign(db, "RVD-MPFM-COM-05-26");
  const input = toInput(before);
  input.id = "RVD-MPFM-COM-05-26-REV1";

  const result = await saveCalibrationCampaign(db, "RVD-MPFM-COM-05-26", input);
  assert.deepEqual(result, { ok: true });

  assert.equal(await loadCalibrationCampaign(db, "RVD-MPFM-COM-05-26"), null);
  const renamed = await loadCalibrationCampaign(db, "RVD-MPFM-COM-05-26-REV1");
  assert.equal(renamed.tag, "13FT0317");
});
```

- [ ] **Step 2: Run the test file to confirm it fails (module doesn't exist yet)**

Run: `node --test tests/calibration-write.test.mjs`
Expected: FAIL — `Cannot find module '../db/calibration-write.ts'` (or equivalent module-resolution error).

- [ ] **Step 3: Implement `db/calibration-write.ts`**

Create `db/calibration-write.ts`:

```ts
/**
 * Writes a calibration campaign back to D1 — the counterpart to
 * `db/calibration.ts`'s `loadCalibrationCampaign`. Input shape matches
 * exactly what that function returns, minus `rows` and `raw` (both stay
 * read-only/import-only — see docs/superpowers/specs/2026-07-14-
 * calibration-integration-phase2-design.md).
 */

import type { D1Batchable } from "./portal-data";

export interface CampaignInput {
  id: string;
  revision: string;
  nature: string;
  asset: string;
  well: string;
  tag: string;
  serial: string;
  reference: string;
  start: string | null;
  end: string | null;
  postStart: string | null;
  postEnd: string | null;
  pb: number | null;
  hcLimit: number | null;
  totalLimit: number | null;
  pvtLimit: number | null;
  kMin: number | null;
  kMax: number | null;
  minRecords: number | null;
  pvtMonths: number | null;
  timezone: string;
  responsible: string;
  approver: string;
  envelope: {
    p: [number | null, number | null];
    t: [number | null, number | null];
    dp: [number | null, number | null];
    gvf: [number | null, number | null];
    wlr: [number | null, number | null];
  };
  pvt: {
    asOil: number | null;
    asGas: number | null;
    asWater: number | null;
    postOil: number | null;
    postGas: number | null;
    postWater: number | null;
    file: string;
    hash: string;
    software: string;
    version: string;
    approver: string;
  };
  uncertainty: {
    asMpfm: number | null;
    asRef: number | null;
    postMpfm: number | null;
    postRef: number | null;
  };
  k: {
    oilApproved: number | null;
    gasApproved: number | null;
    waterApproved: number | null;
    oilApplied: number | null;
    gasApplied: number | null;
    waterApplied: number | null;
    date: string;
    responsible: string;
    evidence: string;
  };
  evidence: boolean;
  approvals: boolean;
}

const UPDATE_CAMPAIGN_SQL = `UPDATE calibration_campaigns SET
  campaign_id = ?, revision = ?, nature = ?, asset = ?, well = ?, tag = ?, serial = ?,
  reference_tag = ?, start_at = ?, end_at = ?, post_start_at = ?, post_end_at = ?,
  pb_barg = ?, hc_limit_pct = ?, total_limit_pct = ?, pvt_limit_pct = ?,
  k_min = ?, k_max = ?, min_records = ?, pvt_months = ?, timezone = ?,
  responsible = ?, approver = ?,
  envelope_p_min = ?, envelope_p_max = ?, envelope_t_min = ?, envelope_t_max = ?,
  envelope_dp_min = ?, envelope_dp_max = ?, envelope_gvf_min = ?, envelope_gvf_max = ?,
  envelope_wlr_min = ?, envelope_wlr_max = ?, evidence = ?, approvals = ?
  WHERE id = ?`;

const UPSERT_PVT_SQL = `INSERT INTO calibration_pvt_records
  (campaign_id, condition, file, sha256, software, version, output_oil_t, output_gas_t, output_water_t, approver)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (campaign_id, condition) DO UPDATE SET
    file = excluded.file, sha256 = excluded.sha256, software = excluded.software,
    version = excluded.version, output_oil_t = excluded.output_oil_t,
    output_gas_t = excluded.output_gas_t, output_water_t = excluded.output_water_t,
    approver = excluded.approver`;

const UPSERT_K_OLEO_SQL = `INSERT INTO calibration_k_applications
  (campaign_id, phase, k_approved, k_applied, applied_at, responsible, evidence_id)
  VALUES (?, 'ÓLEO', ?, ?, ?, ?, ?)
  ON CONFLICT (campaign_id, phase) DO UPDATE SET
    k_approved = excluded.k_approved, k_applied = excluded.k_applied,
    applied_at = excluded.applied_at, responsible = excluded.responsible,
    evidence_id = excluded.evidence_id`;

const UPSERT_K_SIMPLE_SQL = `INSERT INTO calibration_k_applications
  (campaign_id, phase, k_approved, k_applied)
  VALUES (?, ?, ?, ?)
  ON CONFLICT (campaign_id, phase) DO UPDATE SET
    k_approved = excluded.k_approved, k_applied = excluded.k_applied`;

const UPSERT_UNCERTAINTY_SQL = `INSERT INTO calibration_uncertainty
  (campaign_id, condition, u_mpfm_hc_pp, u_ref_hc_pp)
  VALUES (?, ?, ?, ?)
  ON CONFLICT (campaign_id, condition) DO UPDATE SET
    u_mpfm_hc_pp = excluded.u_mpfm_hc_pp, u_ref_hc_pp = excluded.u_ref_hc_pp`;

export async function saveCalibrationCampaign(
  db: D1Batchable,
  campaignId: string,
  input: CampaignInput,
): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  const existing = await db
    .prepare(`SELECT id FROM calibration_campaigns WHERE campaign_id = ?`)
    .bind(campaignId)
    .first<{ id: number }>();
  if (!existing) return { ok: false, reason: "not_found" };
  const id = existing.id;

  await db.batch([
    db.prepare(UPDATE_CAMPAIGN_SQL).bind(
      input.id, input.revision, input.nature, input.asset, input.well, input.tag, input.serial,
      input.reference, input.start, input.end, input.postStart, input.postEnd,
      input.pb, input.hcLimit, input.totalLimit, input.pvtLimit,
      input.kMin, input.kMax, input.minRecords, input.pvtMonths, input.timezone,
      input.responsible, input.approver,
      input.envelope.p[0], input.envelope.p[1], input.envelope.t[0], input.envelope.t[1],
      input.envelope.dp[0], input.envelope.dp[1], input.envelope.gvf[0], input.envelope.gvf[1],
      input.envelope.wlr[0], input.envelope.wlr[1],
      input.evidence ? 1 : 0, input.approvals ? 1 : 0,
      id,
    ),
    db.prepare(UPSERT_PVT_SQL).bind(
      id, "AS_FOUND", input.pvt.file, input.pvt.hash, input.pvt.software, input.pvt.version,
      input.pvt.asOil, input.pvt.asGas, input.pvt.asWater, input.pvt.approver,
    ),
    db.prepare(UPSERT_PVT_SQL).bind(
      id, "POST_K", input.pvt.file, input.pvt.hash, input.pvt.software, input.pvt.version,
      input.pvt.postOil, input.pvt.postGas, input.pvt.postWater, input.pvt.approver,
    ),
    db.prepare(UPSERT_K_OLEO_SQL).bind(
      id, input.k.oilApproved, input.k.oilApplied, input.k.date, input.k.responsible, input.k.evidence,
    ),
    db.prepare(UPSERT_K_SIMPLE_SQL).bind(id, "GÁS", input.k.gasApproved, input.k.gasApplied),
    db.prepare(UPSERT_K_SIMPLE_SQL).bind(id, "ÁGUA", input.k.waterApproved, input.k.waterApplied),
    db.prepare(UPSERT_UNCERTAINTY_SQL).bind(id, "AS_FOUND", input.uncertainty.asMpfm, input.uncertainty.asRef),
    db.prepare(UPSERT_UNCERTAINTY_SQL).bind(id, "POST_K", input.uncertainty.postMpfm, input.uncertainty.postRef),
  ]);

  return { ok: true };
}
```

- [ ] **Step 4: Run the test file again to confirm it passes**

Run: `node --test tests/calibration-write.test.mjs`
Expected: PASS — 5 tests, 0 failures.

- [ ] **Step 5: Run the full root test suite to confirm no regressions**

Run: `npm test`
Expected: PASS — exit code 0 (this builds first, then runs every `tests/*.test.mjs`, including the new file and the existing `calibration-query.test.mjs`).

- [ ] **Step 6: Commit**

```bash
git add db/calibration-write.ts tests/calibration-write.test.mjs
git commit -m "feat: add saveCalibrationCampaign for writing calibration data to D1"
```

---

### Task 3: `PUT /api/calibration` route handler

**Files:**
- Modify: `app/api/calibration/route.ts`

**Interfaces:**
- Consumes: `saveCalibrationCampaign` and `CampaignInput` from `db/calibration-write.ts` (Task 2); existing `loadCalibrationCampaign` from `db/calibration.ts`; existing `corsHeaders(request)` helper already in this file.
- Produces: the live `PUT` endpoint. Task 4 (frontend) and Task 5 (manual E2E verification) both depend on this being deployed/running.

- [ ] **Step 1: Add the import**

At the top of `app/api/calibration/route.ts`, alongside the existing import, add:

```ts
import { saveCalibrationCampaign, type CampaignInput } from "../../../db/calibration-write";
```

- [ ] **Step 2: Update `OPTIONS` to announce `PUT` and the `Content-Type` header**

Find:

```ts
export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: { ...corsHeaders(request), "Access-Control-Allow-Methods": "GET" } });
}
```

Replace with:

```ts
export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      "Access-Control-Allow-Methods": "GET, PUT",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
```

- [ ] **Step 3: Add the validation helper and the `PUT` handler**

At the end of `app/api/calibration/route.ts` (after the existing `GET` function), add:

```ts
function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isTuple(value: unknown): value is [number | null, number | null] {
  return Array.isArray(value) && value.length === 2 && isNumberOrNull(value[0]) && isNumberOrNull(value[1]);
}

function parseCampaignInput(body: unknown): CampaignInput | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  const requiredStrings = ["id", "revision", "nature", "asset", "well", "tag", "serial", "reference", "timezone", "responsible", "approver"] as const;
  for (const key of requiredStrings) if (!isString(b[key])) return null;

  const requiredNumbers = ["pb", "hcLimit", "totalLimit", "pvtLimit", "kMin", "kMax", "minRecords", "pvtMonths"] as const;
  for (const key of requiredNumbers) if (!isNumberOrNull(b[key])) return null;

  const nullableStrings = ["start", "end", "postStart", "postEnd"] as const;
  for (const key of nullableStrings) if (b[key] !== null && !isString(b[key])) return null;

  if (typeof b.evidence !== "boolean" || typeof b.approvals !== "boolean") return null;

  const envelope = b.envelope as Record<string, unknown> | undefined;
  if (typeof envelope !== "object" || envelope === null) return null;
  const axes = ["p", "t", "dp", "gvf", "wlr"] as const;
  for (const axis of axes) if (!isTuple(envelope[axis])) return null;

  const pvt = b.pvt as Record<string, unknown> | undefined;
  if (typeof pvt !== "object" || pvt === null) return null;
  const pvtNumbers = ["asOil", "asGas", "asWater", "postOil", "postGas", "postWater"] as const;
  for (const key of pvtNumbers) if (!isNumberOrNull(pvt[key])) return null;
  const pvtStrings = ["file", "hash", "software", "version", "approver"] as const;
  for (const key of pvtStrings) if (!isString(pvt[key])) return null;

  const uncertainty = b.uncertainty as Record<string, unknown> | undefined;
  if (typeof uncertainty !== "object" || uncertainty === null) return null;
  const uncertaintyNumbers = ["asMpfm", "asRef", "postMpfm", "postRef"] as const;
  for (const key of uncertaintyNumbers) if (!isNumberOrNull(uncertainty[key])) return null;

  const k = b.k as Record<string, unknown> | undefined;
  if (typeof k !== "object" || k === null) return null;
  const kNumbers = ["oilApproved", "gasApproved", "waterApproved", "oilApplied", "gasApplied", "waterApplied"] as const;
  for (const key of kNumbers) if (!isNumberOrNull(k[key])) return null;
  const kStrings = ["date", "responsible", "evidence"] as const;
  for (const key of kStrings) if (!isString(k[key])) return null;

  return {
    id: b.id as string,
    revision: b.revision as string,
    nature: b.nature as string,
    asset: b.asset as string,
    well: b.well as string,
    tag: b.tag as string,
    serial: b.serial as string,
    reference: b.reference as string,
    start: b.start as string | null,
    end: b.end as string | null,
    postStart: b.postStart as string | null,
    postEnd: b.postEnd as string | null,
    pb: b.pb as number | null,
    hcLimit: b.hcLimit as number | null,
    totalLimit: b.totalLimit as number | null,
    pvtLimit: b.pvtLimit as number | null,
    kMin: b.kMin as number | null,
    kMax: b.kMax as number | null,
    minRecords: b.minRecords as number | null,
    pvtMonths: b.pvtMonths as number | null,
    timezone: b.timezone as string,
    responsible: b.responsible as string,
    approver: b.approver as string,
    envelope: envelope as CampaignInput["envelope"],
    pvt: pvt as CampaignInput["pvt"],
    uncertainty: uncertainty as CampaignInput["uncertainty"],
    k: k as CampaignInput["k"],
    evidence: b.evidence as boolean,
    approvals: b.approvals as boolean,
  };
}

export async function PUT(request: Request) {
  const headers = corsHeaders(request);
  try {
    if (!env.DB) {
      return Response.json({ status: "unavailable", error: "Base D1 não vinculada." }, { status: 503, headers });
    }

    const campaignId = new URL(request.url).searchParams.get("campaignId");
    if (!campaignId) {
      return Response.json({ status: "error", error: "Parâmetro campaignId é obrigatório." }, { status: 400, headers });
    }

    const body = await request.json().catch(() => null);
    const input = parseCampaignInput(body);
    if (!input) {
      return Response.json({ status: "error", error: "Corpo da requisição inválido." }, { status: 400, headers });
    }

    const result = await saveCalibrationCampaign(env.DB, campaignId, input);
    if (!result.ok) {
      return Response.json({ status: "error", error: `Campanha não encontrada: ${campaignId}` }, { status: 404, headers });
    }

    const campaign = await loadCalibrationCampaign(env.DB, input.id);
    return Response.json({ status: "ok", campaign }, { headers });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    const message = /no such table|D1_ERROR/i.test(detail)
      ? "A base real ainda não foi inicializada neste ambiente. A migração será aplicada na publicação."
      : "Falha ao gravar a base real.";
    return Response.json({ status: "error", error: message }, { status: 500, headers });
  }
}
```

- [ ] **Step 4: Build the root app to confirm it compiles**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 5: Run the root test suite**

Run: `npm test`
Expected: exits 0, same pass count as Task 2's Step 5 (this task only touched the route file, not the tested `db/*` functions).

- [ ] **Step 6: Commit**

```bash
git add app/api/calibration/route.ts
git commit -m "feat: add PUT handler to persist calibration campaign edits"
```

---

### Task 4: Wire the Metrolog "Salvar" button to the new API

**Files:**
- Modify: `apps/calibration/src/main.tsx`

**Interfaces:**
- Consumes: `PUT /api/calibration?campaignId=` from Task 3, called via same-origin relative `fetch()` (see Global Constraints — same origin because Phase 1 serves this app from `public/calibracao/` on the Portal SGM domain).
- Produces: no new interface — this is the last consumer in this phase.

- [ ] **Step 1: Replace the `save` function**

In `apps/calibration/src/main.tsx`, find:

```tsx
const save=()=>{localStorage.setItem('mpfm-campaign',JSON.stringify(c));flash('Campanha salva neste navegador.')};
```

Replace with:

```tsx
const save=async()=>{
 localStorage.setItem('mpfm-campaign',JSON.stringify(c));
 try{
  const res=await fetch(`/api/calibration?campaignId=${encodeURIComponent(c.id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:c.id,revision:c.revision,nature:c.nature,asset:c.asset,well:c.well,tag:c.tag,serial:c.serial,reference:c.reference,start:c.start,end:c.end,postStart:c.postStart,postEnd:c.postEnd,pb:c.pb,hcLimit:c.hcLimit,totalLimit:c.totalLimit,pvtLimit:c.pvtLimit,kMin:c.kMin,kMax:c.kMax,minRecords:c.minRecords,pvtMonths:c.pvtMonths,timezone:c.timezone,responsible:c.responsible,approver:c.approver,envelope:c.envelope,pvt:c.pvt,uncertainty:c.uncertainty,k:c.k,evidence:c.evidence,approvals:c.approvals})});
  if(!res.ok) throw new Error(String(res.status));
  flash('Campanha salva no navegador e na base real.');
 }catch{
  flash('Campanha salva neste navegador (base real indisponível).');
 }
};
```

(This makes `save` async — its only caller is `save={()=>{save();setDrawer(false)}}` in the `Drawer` invocation inside `App()`; that call site doesn't await it today and doesn't need to, since `save()` already handles both its outcomes internally via `flash()` — no other change needed there.)

- [ ] **Step 2: Run the calibration app's own test suite**

Run: `cd apps/calibration && npm test`
Expected: `1 passed` — unchanged, `engine.test.ts` only exercises `calculate()`, not `save()`.

- [ ] **Step 3: Build the calibration app**

```bash
cd apps/calibration
npm run build
cd ../..
```

Expected: exits 0.

- [ ] **Step 4: Copy the rebuilt output into `public/calibracao/` (per the Phase 1 deploy workflow already documented in `apps/calibration/README.md`)**

```bash
rm -rf public/calibracao
mkdir -p public/calibracao
cp -r apps/calibration/dist/. public/calibracao/
```

- [ ] **Step 5: Commit**

```bash
git add apps/calibration/src/main.tsx public/calibracao
git commit -m "feat: wire calibration app Save button to the write API"
```

---

### Task 5: End-to-end verification and docs update

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything from Tasks 1-4 running together as one system.
- Produces: confirmation the phase goal is met, plus accurate docs.

- [ ] **Step 1: Update `CLAUDE.md`'s Calibration domain paragraph**

Find (added in Phase 1):

```markdown
`db/calibration.ts` → `loadCalibrationCampaign` returns a payload
shaped to match that engine's `Campaign`/`Row` types field for field, so it
can be fed to `calculate()` with no reshaping (still read-only via
`GET /api/calibration` as of Phase 1 — write-back is Phase 2).
```

Replace with:

```markdown
`db/calibration.ts` → `loadCalibrationCampaign` returns a payload
shaped to match that engine's `Campaign`/`Row` types field for field, so it
can be fed to `calculate()` with no reshaping. As of Phase 2 (2026-07-14),
`PUT /api/calibration?campaignId=` (`db/calibration-write.ts` →
`saveCalibrationCampaign`) persists edits back to the same tables — scoped to
exactly the fields the engine's `Campaign` type carries (scalar fields,
envelope, PVT, K-factors, uncertainty, evidence/approvals). It only updates
an existing campaign (404 if not found) — creating a campaign is still
exclusively `scripts/import-mpfm-calibration.py`'s job. `rows` (MPFM/
separator readings) and everything under `campaign.raw` stay read-only/
import-only. The Metrolog app's "Salvar" button calls this endpoint (same
origin as of Phase 1) in addition to its existing `localStorage` save.
```

- [ ] **Step 2: Start the root dev server**

```bash
export WRANGLER_LOG_PATH=.wrangler/wrangler.log
npx vite &
sleep 6
```

- [ ] **Step 3: Confirm a scalar edit round-trips through the real HTTP endpoint**

```bash
curl -s -X PUT "http://localhost:5173/api/calibration?campaignId=RVD-MPFM-COM-05-26" \
  -H "Content-Type: application/json" \
  -d '{"id":"RVD-MPFM-COM-05-26","revision":"Rev. 0","nature":"COMISSIONAMENTO","asset":"FPSO Bacalhau","well":"Riser P4 / PW-104DA","tag":"13FT0317","serial":"13-100060","reference":"Separador de Teste 20VA121","start":"2026-06-29T12:00","end":"2026-06-30T12:00","postStart":"2026-07-03T00:00","postEnd":"2026-07-04T00:00","pb":480,"hcLimit":0.1,"totalLimit":0.07,"pvtLimit":0.01,"kMin":0.8,"kMax":1.2,"minRecords":24,"pvtMonths":6,"timezone":"","responsible":"Verificação E2E","approver":"","envelope":{"p":[null,null],"t":[null,null],"dp":[null,null],"gvf":[null,null],"wlr":[null,null]},"pvt":{"asOil":8300.167244453569,"asGas":1890.24,"asWater":0,"postOil":8337.14,"postGas":1907.74,"postWater":0,"file":"","hash":"","software":"Calsep PVTSim","version":"23.1.0","approver":"PETEC"},"uncertainty":{"asMpfm":5,"asRef":0.895015,"postMpfm":5,"postRef":0.8949582504869433},"k":{"oilApproved":1.0259281736761987,"gasApproved":1.019174217842666,"waterApproved":1,"oilApplied":1.0259281736761987,"gasApplied":1.019174217842666,"waterApplied":1,"date":"2026-06-30T12:00","responsible":"Gabriel Chargue","evidence":"Tela da aplicação / FCS320 v3.4.1 Build 210"},"evidence":false,"approvals":false}' \
  -w "\n%{http_code}\n"

curl -s "http://localhost:5173/api/calibration?campaignId=RVD-MPFM-COM-05-26" | grep -o '"responsible":"Verificação E2E"'
```

Expected: the `PUT` prints a JSON body ending in `200`; the follow-up `GET` prints `"responsible":"Verificação E2E"`, confirming the edit round-tripped through the real running server (not just the unit tests).

- [ ] **Step 4: Confirm 404 for an unknown campaign**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PUT "http://localhost:5173/api/calibration?campaignId=DOES-NOT-EXIST" \
  -H "Content-Type: application/json" -d '{}'
```

Expected: `404`.

- [ ] **Step 5: Confirm 400 for a malformed body**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PUT "http://localhost:5173/api/calibration?campaignId=RVD-MPFM-COM-05-26" \
  -H "Content-Type: application/json" -d '{"not":"a valid campaign"}'
```

Expected: `400`.

- [ ] **Step 6: Confirm the calibration route (served from `public/calibracao/`, rebuilt in Task 4) still serves correctly**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/calibracao/
```

Expected: `200`.

- [ ] **Step 7: Stop the dev server**

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

(Per Task 6 of the Phase 1 plan, `kill %1` does not reliably stop this background process on this Windows Git Bash setup — use `Stop-Process` directly.)

- [ ] **Step 8: Run both test suites one more time**

```bash
npm test
cd apps/calibration && npm test && cd ../..
```

Expected: both exit 0.

- [ ] **Step 9: Commit the docs update**

```bash
git add CLAUDE.md
git commit -m "docs: reflect the calibration write API landing in Phase 2"
```

- [ ] **Step 10: Final status check**

```bash
git status -sb
```

Expected: clean (only the branch-tracking line, no untracked/modified files).
