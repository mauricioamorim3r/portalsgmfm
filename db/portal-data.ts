/**
 * Query logic for the portal dashboard, extracted from the API route so it
 * can run against any D1-shaped database — including a plain node:sqlite
 * shim in tests — without needing `cloudflare:workers`.
 */

export type D1Row = Record<string, string | number | null>;

export interface D1Statement {
  bind(...values: unknown[]): {
    all<T = unknown>(): Promise<{ results?: T[] }>;
    first<T = unknown>(): Promise<T | null>;
  };
}

export interface D1Queryable {
  prepare(sql: string): D1Statement;
}

export interface D1Batchable extends D1Queryable {
  batch<T = unknown>(statements: unknown[]): Promise<T[]>;
}

async function all(db: D1Queryable, sql: string, ...bindings: unknown[]): Promise<D1Row[]> {
  const result = await db.prepare(sql).bind(...bindings).all<D1Row>();
  return result.results ?? [];
}

async function first(db: D1Queryable, sql: string, ...bindings: unknown[]): Promise<D1Row> {
  return (await db.prepare(sql).bind(...bindings).first<D1Row>()) ?? {};
}

export async function loadPortalData(db: D1Queryable) {
  const [sources, points, wells, summary, quality, dailyTrend, latestByTag, separatorSummary, issues] = await Promise.all([
    all(db, `SELECT id, file_name, source_type, source_sheet, period_start, period_end, row_count, imported_at
         FROM source_files ORDER BY imported_at DESC, id DESC`),
    all(db, `SELECT tag, installation_code, fluid, primary_measurement, secondary_measurement,
                meter_type, location, flow_computer, active
         FROM measurement_points ORDER BY tag`),
    all(db, `SELECT anp_code, anp_name, operator_name, field_name, status, category
         FROM wells ORDER BY anp_name, anp_code`),
    first(db, `SELECT
        COUNT(*) AS measurement_rows,
        COUNT(DISTINCT tag) AS measured_tags,
        MIN(production_date) AS period_start,
        MAX(production_date) AS period_end,
        SUM(CASE WHEN granularity='Hourly' THEN 1 ELSE 0 END) AS hourly_rows,
        SUM(CASE WHEN granularity='Daily' THEN 1 ELSE 0 END) AS daily_rows
      FROM mpfm_measurements`),
    first(db, `WITH groups AS (
        SELECT production_date, tag,
          COUNT(DISTINCT CASE WHEN granularity='Hourly' THEN hour END) AS hours,
          SUM(CASE WHEN granularity='Daily' THEN 1 ELSE 0 END) AS daily_count,
          SUM(CASE WHEN granularity='Daily' THEN COALESCE(hc_t,0) ELSE 0 END) AS daily_hc,
          SUM(CASE WHEN granularity='Daily' THEN COALESCE(total_t,0) ELSE 0 END) AS daily_total
        FROM mpfm_measurements
        WHERE granularity IN ('Hourly','Daily')
        GROUP BY production_date, tag
      )
      SELECT COUNT(*) AS groups_total,
        SUM(CASE WHEN hours=24 THEN 1 ELSE 0 END) AS complete_24h,
        SUM(CASE WHEN hours BETWEEN 1 AND 23 THEN 1 ELSE 0 END) AS partial_hours,
        SUM(CASE WHEN daily_count=0 AND hours>0 THEN 1 ELSE 0 END) AS hourly_without_daily,
        SUM(CASE WHEN daily_count>0 AND daily_hc=0 AND daily_total=0 AND hours>0 THEN 1 ELSE 0 END) AS zero_daily_with_hourly
      FROM groups`),
    all(db, `SELECT production_date AS day,
        ROUND(SUM(CASE WHEN granularity='Daily' THEN COALESCE(oil_t,0) ELSE 0 END),3) AS oil_t,
        ROUND(SUM(CASE WHEN granularity='Daily' THEN COALESCE(gas_t,0) ELSE 0 END),3) AS gas_t,
        ROUND(SUM(CASE WHEN granularity='Daily' THEN COALESCE(water_t,0) ELSE 0 END),3) AS water_t,
        COUNT(DISTINCT CASE WHEN granularity='Hourly' THEN tag || ':' || hour END) AS hourly_slots
      FROM mpfm_measurements
      GROUP BY production_date ORDER BY production_date DESC LIMIT 31`),
    all(db, `WITH latest AS (SELECT MAX(production_date) AS day FROM mpfm_measurements)
      SELECT m.tag, m.bank, m.entity, m.production_date,
        COUNT(DISTINCT CASE WHEN m.granularity='Hourly' THEN m.hour END) AS hours,
        ROUND(SUM(CASE WHEN m.granularity='Daily' THEN COALESCE(m.total_t,0) ELSE 0 END),3) AS daily_total_t
      FROM mpfm_measurements m, latest
      WHERE m.production_date=latest.day
      GROUP BY m.tag, m.bank, m.entity, m.production_date ORDER BY m.tag`),
    first(db, `SELECT COUNT(*) AS rows, COUNT(DISTINCT production_date) AS days,
        MIN(production_date) AS period_start, MAX(production_date) AS period_end,
        COUNT(DISTINCT phase) AS phases
      FROM separator_measurements`),
    all(db, `SELECT issue_type, severity, COUNT(*) AS count
      FROM data_quality_issues GROUP BY issue_type, severity ORDER BY count DESC LIMIT 20`),
  ]);

  return {
    sources,
    cadastros: { measurementPoints: points, wells },
    measurements: { summary, dailyTrend: dailyTrend.reverse(), latestByTag },
    separator: separatorSummary,
    quality: { ...quality, issues },
  };
}
