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
  quality: string;
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
  (campaign_id, condition, timestamp, use_flag, duration_h, quality, pressure_barg, temperature_c, dp_kpa, gvf_pct, wlr_pct, oil_uncorr_t, gas_uncorr_t, water_uncorr_t, oil_corr_t, gas_corr_t, water_corr_t)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (campaign_id, condition, timestamp) DO UPDATE SET
    use_flag = excluded.use_flag, duration_h = excluded.duration_h, quality = excluded.quality,
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
        id, condition, row.timestamp, row.use ? 1 : 0, row.duration, row.quality,
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
