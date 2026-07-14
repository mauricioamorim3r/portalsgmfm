/**
 * Assembles a calibration campaign in the shape the standalone MPFM
 * calibration engine (Portal_MPFM_Riser_P4_v1.zip, src/main.tsx `Campaign`
 * type) expects as input to `calculate(c)` — sourced from Portal SGM's D1
 * instead of a manually uploaded Excel file.
 *
 * Field names intentionally mirror that engine's `Campaign`/`Row` types so
 * this payload can be fed to `calculate()` with no reshaping. Anything the
 * engine's v1 `calculate()` doesn't consume (separator, lab, per-phase K
 * detail) is still returned under `raw` for traceability and future engine
 * versions — see docs/data-quality and the calibration_* tables.
 */

import type { D1Queryable, D1Row } from "./portal-data";

async function all(db: D1Queryable, sql: string, ...bindings: unknown[]): Promise<D1Row[]> {
  const result = await db.prepare(sql).bind(...bindings).all<D1Row>();
  return result.results ?? [];
}

async function first(db: D1Queryable, sql: string, ...bindings: unknown[]): Promise<D1Row | null> {
  return await db.prepare(sql).bind(...bindings).first<D1Row>();
}

function byCondition(rows: D1Row[]): Record<string, D1Row> {
  return Object.fromEntries(rows.map((row) => [String(row.condition), row]));
}

function byPhase(rows: D1Row[]): Record<string, D1Row> {
  return Object.fromEntries(rows.map((row) => [String(row.phase), row]));
}

export async function loadCalibrationCampaign(db: D1Queryable, campaignId: string) {
  const campaign = await first(db, `SELECT * FROM calibration_campaigns WHERE campaign_id = ?`, campaignId);
  if (!campaign) return null;

  const id = campaign.id;
  const [mpfmRows, separatorRows, labResults, pvtRecords, kApplications, uncertaintyRows] = await Promise.all([
    all(db, `SELECT condition, timestamp, use_flag, duration_h, quality, pressure_barg, temperature_c,
                dp_kpa, gvf_pct, wlr_pct, oil_uncorr_t, gas_uncorr_t, water_uncorr_t, oil_corr_t, gas_corr_t, water_corr_t
         FROM calibration_mpfm_rows WHERE campaign_id = ? ORDER BY condition, timestamp`, id),
    all(db, `SELECT condition, timestamp, use_flag, duration_h, quality, pressure_barg, temperature_c,
                oil_gv_line_m3, oil_rho_coriolis_kgm3, oil_mass_direct_t, gas_mass_t, water_mass_t,
                gas_std_ksm3, water_vol_m3, source_ref
         FROM calibration_separator_rows WHERE campaign_id = ? ORDER BY condition, timestamp`, id),
    all(db, `SELECT sample_id, use_flag, sampled_at, sample_type, bsw_pct, rho_oil_std_kgm3, rho_gas_std_kgsm3,
                rho_water_std_kgm3, fe, rs, method, report_id, status
         FROM calibration_lab_results WHERE campaign_id = ? ORDER BY sampled_at`, id),
    all(db, `SELECT * FROM calibration_pvt_records WHERE campaign_id = ?`, id),
    all(db, `SELECT * FROM calibration_k_applications WHERE campaign_id = ?`, id),
    all(db, `SELECT * FROM calibration_uncertainty WHERE campaign_id = ?`, id),
  ]);

  const pvtByCondition = byCondition(pvtRecords);
  const uncertaintyByCondition = byCondition(uncertaintyRows);
  const kByPhase = byPhase(kApplications);
  const kOil = kByPhase["ÓLEO"] ?? {};
  const kGas = kByPhase["GÁS"] ?? {};
  const kWater = kByPhase["ÁGUA"] ?? {};
  const pvtAs = pvtByCondition["AS_FOUND"] ?? {};
  const pvtPost = pvtByCondition["POST_K"] ?? {};
  const uAs = uncertaintyByCondition["AS_FOUND"] ?? {};
  const uPost = uncertaintyByCondition["POST_K"] ?? {};

  return {
    id: campaign.campaign_id,
    revision: campaign.revision,
    nature: campaign.nature,
    asset: campaign.asset,
    well: campaign.well,
    tag: campaign.tag,
    serial: campaign.serial,
    reference: campaign.reference_tag,
    start: campaign.start_at,
    end: campaign.end_at,
    postStart: campaign.post_start_at,
    postEnd: campaign.post_end_at,
    pb: campaign.pb_barg,
    hcLimit: campaign.hc_limit_pct,
    totalLimit: campaign.total_limit_pct,
    pvtLimit: campaign.pvt_limit_pct,
    kMin: campaign.k_min,
    kMax: campaign.k_max,
    minRecords: campaign.min_records,
    pvtMonths: campaign.pvt_months,
    timezone: campaign.timezone,
    responsible: campaign.responsible,
    approver: campaign.approver,
    envelope: {
      p: [campaign.envelope_p_min, campaign.envelope_p_max],
      t: [campaign.envelope_t_min, campaign.envelope_t_max],
      dp: [campaign.envelope_dp_min, campaign.envelope_dp_max],
      gvf: [campaign.envelope_gvf_min, campaign.envelope_gvf_max],
      wlr: [campaign.envelope_wlr_min, campaign.envelope_wlr_max],
    },
    pvt: {
      asOil: pvtAs.output_oil_t ?? null,
      asGas: pvtAs.output_gas_t ?? null,
      asWater: pvtAs.output_water_t ?? null,
      postOil: pvtPost.output_oil_t ?? null,
      postGas: pvtPost.output_gas_t ?? null,
      postWater: pvtPost.output_water_t ?? null,
      file: pvtAs.file ?? pvtPost.file ?? "",
      hash: pvtAs.sha256 ?? pvtPost.sha256 ?? "",
      software: pvtAs.software ?? pvtPost.software ?? "",
      version: pvtAs.version ?? pvtPost.version ?? "",
      approver: pvtAs.approver ?? pvtPost.approver ?? "",
    },
    uncertainty: {
      asMpfm: uAs.u_mpfm_hc_pp ?? null,
      asRef: uAs.u_ref_hc_pp ?? null,
      postMpfm: uPost.u_mpfm_hc_pp ?? null,
      postRef: uPost.u_ref_hc_pp ?? null,
    },
    k: {
      oilApproved: kOil.k_approved ?? null,
      gasApproved: kGas.k_approved ?? null,
      waterApproved: kWater.k_approved ?? null,
      oilApplied: kOil.k_applied ?? null,
      gasApplied: kGas.k_applied ?? null,
      waterApplied: kWater.k_applied ?? null,
      date: kOil.applied_at ?? "",
      responsible: kOil.responsible ?? "",
      evidence: kOil.evidence_id ?? "",
    },
    evidence: Boolean(campaign.evidence),
    approvals: Boolean(campaign.approvals),
    rows: mpfmRows.map((row) => ({
      condition: row.condition,
      timestamp: row.timestamp,
      use: Boolean(row.use_flag),
      duration: row.duration_h,
      p: row.pressure_barg,
      t: row.temperature_c,
      dp: row.dp_kpa,
      gvf: row.gvf_pct,
      wlr: row.wlr_pct,
      oil: row.oil_uncorr_t,
      gas: row.gas_uncorr_t,
      water: row.water_uncorr_t,
      oilCorr: row.oil_corr_t,
      gasCorr: row.gas_corr_t,
      waterCorr: row.water_corr_t,
    })),
    raw: {
      separatorRows,
      labResults,
      pvtRecords,
      kApplications,
      uncertaintyRows,
    },
  };
}
