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

const INSERT_CAMPAIGN_SQL = `INSERT INTO calibration_campaigns
  (campaign_id, revision, nature, asset, well, tag, serial, reference_tag,
   start_at, end_at, post_start_at, post_end_at, pb_barg, hc_limit_pct, total_limit_pct, pvt_limit_pct,
   k_min, k_max, min_records, pvt_months, timezone, responsible, approver,
   envelope_p_min, envelope_p_max, envelope_t_min, envelope_t_max,
   envelope_dp_min, envelope_dp_max, envelope_gvf_min, envelope_gvf_max,
   envelope_wlr_min, envelope_wlr_max, evidence, approvals)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export async function createCalibrationCampaign(
  db: D1Batchable,
  input: CampaignInput,
): Promise<{ ok: true; id: number } | { ok: false; reason: "conflict" }> {
  const existing = await db
    .prepare(`SELECT id FROM calibration_campaigns WHERE campaign_id = ?`)
    .bind(input.id)
    .first<{ id: number }>();
  if (existing) return { ok: false, reason: "conflict" };

  const inserted = await db
    .prepare(INSERT_CAMPAIGN_SQL)
    .bind(
      input.id, input.revision, input.nature, input.asset, input.well, input.tag, input.serial, input.reference,
      input.start, input.end, input.postStart, input.postEnd,
      input.pb, input.hcLimit, input.totalLimit, input.pvtLimit,
      input.kMin, input.kMax, input.minRecords, input.pvtMonths, input.timezone, input.responsible, input.approver,
      input.envelope.p[0], input.envelope.p[1], input.envelope.t[0], input.envelope.t[1],
      input.envelope.dp[0], input.envelope.dp[1], input.envelope.gvf[0], input.envelope.gvf[1],
      input.envelope.wlr[0], input.envelope.wlr[1],
      input.evidence ? 1 : 0, input.approvals ? 1 : 0,
    )
    .run<{ meta: { last_row_id: number } }>();

  const id = inserted.meta.last_row_id;

  await db.batch([
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

  return { ok: true, id };
}
