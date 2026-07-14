import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const sourceFiles = sqliteTable("source_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fileName: text("file_name").notNull(),
  sha256: text("sha256").notNull(),
  sourceType: text("source_type").notNull(),
  sourceSheet: text("source_sheet").notNull().default(""),
  periodStart: text("period_start"),
  periodEnd: text("period_end"),
  rowCount: integer("row_count").notNull().default(0),
  importedAt: text("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("source_files_sha256_type_uq").on(table.sha256, table.sourceType)]);

export const measurementPoints = sqliteTable("measurement_points", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tag: text("tag").notNull(),
  installationCode: text("installation_code").notNull().default(""),
  fluid: text("fluid").notNull().default(""),
  primaryMeasurement: text("primary_measurement").notNull().default(""),
  secondaryMeasurement: text("secondary_measurement").notNull().default(""),
  meterType: text("meter_type").notNull().default(""),
  location: text("location").notNull().default(""),
  flowComputer: text("flow_computer").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sourceFileId: integer("source_file_id").notNull().references(() => sourceFiles.id),
}, (table) => [uniqueIndex("measurement_points_tag_uq").on(table.tag)]);

export const wells = sqliteTable("wells", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  anpCode: text("anp_code").notNull(),
  anpName: text("anp_name").notNull().default(""),
  operatorName: text("operator_name").notNull().default(""),
  fieldName: text("field_name").notNull().default(""),
  status: text("status").notNull().default(""),
  category: text("category").notNull().default(""),
  sourceFileId: integer("source_file_id").notNull().references(() => sourceFiles.id),
}, (table) => [uniqueIndex("wells_anp_code_uq").on(table.anpCode)]);

export const mpfmMeasurements = sqliteTable("mpfm_measurements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceFileId: integer("source_file_id").notNull().references(() => sourceFiles.id),
  sourceRow: integer("source_row").notNull(),
  productionDate: text("production_date").notNull(),
  hour: integer("hour"),
  granularity: text("granularity").notNull(),
  origin: text("origin").notNull().default(""),
  bank: text("bank").notNull().default(""),
  loop: text("loop").notNull().default(""),
  entity: text("entity").notNull().default(""),
  tag: text("tag").notNull(),
  instrument: text("instrument").notNull().default(""),
  gasT: real("gas_t"),
  oilT: real("oil_t"),
  hcT: real("hc_t"),
  waterT: real("water_t"),
  totalT: real("total_t"),
  pressureBarg: real("pressure_barg"),
  temperatureC: real("temperature_c"),
  official: integer("official", { mode: "boolean" }).notNull().default(true),
}, (table) => [
  uniqueIndex("mpfm_source_row_uq").on(table.sourceFileId, table.sourceRow),
  index("mpfm_day_tag_grain_idx").on(table.productionDate, table.tag, table.granularity),
]);

export const separatorMeasurements = sqliteTable("separator_measurements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceFileId: integer("source_file_id").notNull().references(() => sourceFiles.id),
  sourceSheet: text("source_sheet").notNull(),
  sourceRow: integer("source_row").notNull(),
  productionDate: text("production_date").notNull(),
  hour: integer("hour"),
  phase: text("phase").notNull(),
  tag: text("tag").notNull(),
  pressure: real("pressure"),
  temperatureC: real("temperature_c"),
  standardVolume: real("standard_volume"),
  massT: real("mass_t"),
  flowTimeMinutes: real("flow_time_minutes"),
}, (table) => [
  uniqueIndex("separator_source_sheet_row_uq").on(table.sourceFileId, table.sourceSheet, table.sourceRow),
  index("separator_day_phase_idx").on(table.productionDate, table.phase, table.hour),
]);

export const dataQualityIssues = sqliteTable("data_quality_issues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceFileId: integer("source_file_id").references(() => sourceFiles.id),
  productionDate: text("production_date"),
  tag: text("tag").notNull().default(""),
  issueType: text("issue_type").notNull(),
  severity: text("severity").notNull(),
  details: text("details").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("quality_issue_day_idx").on(table.productionDate, table.issueType)]);

// Calibration campaigns (MPFM K-factor commissioning/verification, 16-gate
// metrology workflow). Deliberately separate from the continuous-production
// tables above: a campaign is a bounded, per-TAG calibration event with its
// own AS_FOUND/POST_K windows, not a stream of ongoing production readings.

export const calibrationCampaigns = sqliteTable("calibration_campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: text("campaign_id").notNull(),
  revision: text("revision").notNull().default(""),
  nature: text("nature").notNull().default(""),
  asset: text("asset").notNull().default(""),
  well: text("well").notNull().default(""),
  tag: text("tag").notNull(),
  serial: text("serial").notNull().default(""),
  referenceTag: text("reference_tag").notNull().default(""),
  startAt: text("start_at"),
  endAt: text("end_at"),
  postStartAt: text("post_start_at"),
  postEndAt: text("post_end_at"),
  pbBarg: real("pb_barg"),
  hcLimitPct: real("hc_limit_pct"),
  totalLimitPct: real("total_limit_pct"),
  pvtLimitPct: real("pvt_limit_pct"),
  kMin: real("k_min"),
  kMax: real("k_max"),
  minRecords: integer("min_records"),
  pvtMonths: integer("pvt_months"),
  timezone: text("timezone").notNull().default(""),
  responsible: text("responsible").notNull().default(""),
  approver: text("approver").notNull().default(""),
  envelopePMin: real("envelope_p_min"),
  envelopePMax: real("envelope_p_max"),
  envelopeTMin: real("envelope_t_min"),
  envelopeTMax: real("envelope_t_max"),
  envelopeDpMin: real("envelope_dp_min"),
  envelopeDpMax: real("envelope_dp_max"),
  envelopeGvfMin: real("envelope_gvf_min"),
  envelopeGvfMax: real("envelope_gvf_max"),
  envelopeWlrMin: real("envelope_wlr_min"),
  envelopeWlrMax: real("envelope_wlr_max"),
  evidence: integer("evidence", { mode: "boolean" }).notNull().default(false),
  approvals: integer("approvals", { mode: "boolean" }).notNull().default(false),
  sourceFileId: integer("source_file_id").references(() => sourceFiles.id),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("calibration_campaigns_campaign_id_uq").on(table.campaignId),
  index("calibration_campaigns_tag_idx").on(table.tag),
]);

export const calibrationMpfmRows = sqliteTable("calibration_mpfm_rows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull().references(() => calibrationCampaigns.id),
  condition: text("condition").notNull(),
  timestamp: text("timestamp").notNull(),
  useFlag: integer("use_flag", { mode: "boolean" }).notNull().default(true),
  durationH: real("duration_h"),
  quality: text("quality").notNull().default(""),
  pressureBarg: real("pressure_barg"),
  temperatureC: real("temperature_c"),
  dpKpa: real("dp_kpa"),
  gvfPct: real("gvf_pct"),
  wlrPct: real("wlr_pct"),
  oilUncorrT: real("oil_uncorr_t"),
  gasUncorrT: real("gas_uncorr_t"),
  waterUncorrT: real("water_uncorr_t"),
  oilCorrT: real("oil_corr_t"),
  gasCorrT: real("gas_corr_t"),
  waterCorrT: real("water_corr_t"),
}, (table) => [
  uniqueIndex("calibration_mpfm_rows_uq").on(table.campaignId, table.condition, table.timestamp),
]);

export const calibrationSeparatorRows = sqliteTable("calibration_separator_rows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull().references(() => calibrationCampaigns.id),
  condition: text("condition").notNull(),
  timestamp: text("timestamp").notNull(),
  useFlag: integer("use_flag", { mode: "boolean" }).notNull().default(true),
  durationH: real("duration_h"),
  quality: text("quality").notNull().default(""),
  pressureBarg: real("pressure_barg"),
  temperatureC: real("temperature_c"),
  oilGvLineM3: real("oil_gv_line_m3"),
  oilRhoCoriolisKgm3: real("oil_rho_coriolis_kgm3"),
  oilMassDirectT: real("oil_mass_direct_t"),
  gasMassT: real("gas_mass_t"),
  waterMassT: real("water_mass_t"),
  gasStdKsm3: real("gas_std_ksm3"),
  waterVolM3: real("water_vol_m3"),
  sourceRef: text("source_ref").notNull().default(""),
}, (table) => [
  uniqueIndex("calibration_separator_rows_uq").on(table.campaignId, table.condition, table.timestamp),
]);

export const calibrationLabResults = sqliteTable("calibration_lab_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull().references(() => calibrationCampaigns.id),
  sampleId: text("sample_id").notNull().default(""),
  useFlag: integer("use_flag", { mode: "boolean" }).notNull().default(true),
  sampledAt: text("sampled_at").notNull().default(""),
  sampleType: text("sample_type").notNull().default(""),
  bswPct: real("bsw_pct"),
  rhoOilStdKgm3: real("rho_oil_std_kgm3"),
  rhoGasStdKgsm3: real("rho_gas_std_kgsm3"),
  rhoWaterStdKgm3: real("rho_water_std_kgm3"),
  fe: real("fe"),
  rs: real("rs"),
  method: text("method").notNull().default(""),
  reportId: text("report_id").notNull().default(""),
  status: text("status").notNull().default(""),
});

export const calibrationPvtRecords = sqliteTable("calibration_pvt_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull().references(() => calibrationCampaigns.id),
  condition: text("condition").notNull(),
  file: text("file").notNull().default(""),
  sha256: text("sha256").notNull().default(""),
  software: text("software").notNull().default(""),
  version: text("version").notNull().default(""),
  eosModel: text("eos_model").notNull().default(""),
  loadedAt: text("loaded_at").notNull().default(""),
  approver: text("approver").notNull().default(""),
  inputOilT: real("input_oil_t"),
  inputGasT: real("input_gas_t"),
  inputWaterT: real("input_water_t"),
  outputOilT: real("output_oil_t"),
  outputGasT: real("output_gas_t"),
  outputWaterT: real("output_water_t"),
  pbBarg: real("pb_barg"),
  respondedAt: text("responded_at").notNull().default(""),
}, (table) => [
  uniqueIndex("calibration_pvt_records_uq").on(table.campaignId, table.condition),
]);

export const calibrationKApplications = sqliteTable("calibration_k_applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull().references(() => calibrationCampaigns.id),
  phase: text("phase").notNull(),
  kCalculated: real("k_calculated"),
  kApproved: real("k_approved"),
  kApplied: real("k_applied"),
  appliedAt: text("applied_at").notNull().default(""),
  responsible: text("responsible").notNull().default(""),
  system: text("system").notNull().default(""),
  configVersion: text("config_version").notNull().default(""),
  evidenceId: text("evidence_id").notNull().default(""),
  status: text("status").notNull().default(""),
  notes: text("notes").notNull().default(""),
}, (table) => [
  uniqueIndex("calibration_k_applications_uq").on(table.campaignId, table.phase),
]);

export const calibrationUncertainty = sqliteTable("calibration_uncertainty", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").notNull().references(() => calibrationCampaigns.id),
  condition: text("condition").notNull(),
  uMpfmHcPp: real("u_mpfm_hc_pp"),
  uMpfmTotalPp: real("u_mpfm_total_pp"),
  uRefHcPp: real("u_ref_hc_pp"),
  uRefTotalPp: real("u_ref_total_pp"),
  kMpfm: real("k_mpfm"),
  kRef: real("k_ref"),
  sourceVersion: text("source_version").notNull().default(""),
  status: text("status").notNull().default(""),
}, (table) => [
  uniqueIndex("calibration_uncertainty_uq").on(table.campaignId, table.condition),
]);
