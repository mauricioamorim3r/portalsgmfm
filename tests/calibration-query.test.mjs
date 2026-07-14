import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { loadCalibrationCampaign } from "../db/calibration.ts";

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
          };
        },
      };
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

test("loadCalibrationCampaign returns null for an unknown campaign", async () => {
  const campaign = await loadCalibrationCampaign(toD1Shim(await seededDb()), "DOES-NOT-EXIST");
  assert.equal(campaign, null);
});

test("loadCalibrationCampaign assembles the real Riser P4 campaign for calculate()", async () => {
  const campaign = await loadCalibrationCampaign(toD1Shim(await seededDb()), "RVD-MPFM-COM-05-26");

  assert.equal(campaign.tag, "13FT0317");
  assert.equal(campaign.pb, 480);
  assert.equal(campaign.hcLimit, 0.1);

  // The source campaign genuinely has no envelope registered yet (gate G07
  // is pending) — must come through as nulls, never a guessed range.
  assert.deepEqual(campaign.envelope.p, [null, null]);
  assert.deepEqual(campaign.envelope.wlr, [null, null]);

  assert.equal(campaign.pvt.asOil, 8300.167244453569);
  assert.equal(campaign.pvt.postGas, 1907.74);
  assert.equal(campaign.pvt.software, "Calsep PVTSim");

  assert.equal(campaign.uncertainty.asMpfm, 5);
  assert.equal(campaign.uncertainty.postRef, 0.8949582504869433);

  assert.equal(campaign.k.oilApproved, 1.0259281736761987);
  assert.equal(campaign.k.waterApplied, 1);
  assert.equal(campaign.k.responsible, "Gabriel Chargue");

  assert.equal(campaign.rows.length, 48);
  assert.equal(campaign.rows.filter((row) => row.condition === "AS_FOUND").length, 24);
  assert.equal(campaign.rows.filter((row) => row.condition === "POST_K").length, 24);
  assert.equal(campaign.rows[0].timestamp, "2026-06-29T12:00:00");
  assert.equal(campaign.rows[0].oilCorr, null);
  assert.equal(campaign.rows.at(-1).oilCorr, 343.601);

  assert.equal(campaign.raw.separatorRows.length, 48);
  assert.equal(campaign.raw.labResults.length, 3);
  assert.equal(campaign.raw.pvtRecords.length, 2);
  assert.equal(campaign.raw.kApplications.length, 4);
  assert.equal(campaign.raw.uncertaintyRows.length, 2);
});
