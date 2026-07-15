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
  return { timestamp, use: true, duration: 1, quality: "", p: 116, t: 68, dp: null, gvf: null, wlr: null, oil, gas: 50, water: 0, oilCorr: null, gasCorr: null, waterCorr: null };
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
