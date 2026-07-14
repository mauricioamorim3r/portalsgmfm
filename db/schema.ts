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
