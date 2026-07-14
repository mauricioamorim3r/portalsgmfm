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
