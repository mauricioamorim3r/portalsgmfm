import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { loadPortalData } from "../db/portal-data.ts";

const schema = await readFile(new URL("../drizzle/0000_big_queen_noir.sql", import.meta.url), "utf8");
const seed = await readFile(new URL("../drizzle/0001_real_source_data.sql", import.meta.url), "utf8");

// Adapts node:sqlite's sync StatementSync to the async
// prepare().bind().all()/.first() shape that D1Database exposes, so the
// same query code under test runs against a plain in-memory SQLite db here
// and against real D1 in production.
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

function seededDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(schema);
  db.exec(seed);
  return db;
}

test("loadPortalData aggregates the real seeded source data", async () => {
  const data = await loadPortalData(toD1Shim(seededDb()));

  assert.equal(data.sources.length, 5);
  assert.equal(data.cadastros.measurementPoints.length, 71);
  assert.equal(data.cadastros.wells.length, 44);

  // node:sqlite rows are null-prototype objects; spread onto a plain object
  // so deepEqual compares values only, not [[Prototype]].
  assert.deepEqual({ ...data.measurements.summary }, {
    measurement_rows: 4584,
    measured_tags: 6,
    period_start: "2026-06-01",
    period_end: "2026-07-10",
    hourly_rows: 4120,
    daily_rows: 232,
  });

  assert.equal(data.quality.groups_total, 236);
  assert.equal(data.quality.complete_24h, 129);
  assert.equal(data.quality.partial_hours, 90);
  assert.equal(data.quality.hourly_without_daily, 4);
  assert.equal(data.quality.zero_daily_with_hourly, 11);
  assert.deepEqual(
    data.quality.issues.map((row) => `${row.issue_type}:${row.severity}:${row.count}`),
    ["missing_hours:warn:90", "zero_daily_with_hourly:review:52"],
  );

  assert.equal(data.separator.rows, 3075);
  assert.equal(data.separator.days, 41);
  assert.equal(data.separator.phases, 3);
});

test("dailyTrend is capped at 31 days and ordered ascending by day", async () => {
  const data = await loadPortalData(toD1Shim(seededDb()));
  const { dailyTrend } = data.measurements;

  assert.equal(dailyTrend.length, 31);
  assert.equal(dailyTrend[0].day, "2026-06-10");
  assert.equal(dailyTrend.at(-1).day, "2026-07-10");

  const days = dailyTrend.map((row) => row.day);
  const sortedDays = [...days].sort();
  assert.deepEqual(days, sortedDays, "dailyTrend must be returned oldest-first for the chart");
});

test("latestByTag only contains rows from the single most recent production date", async () => {
  const data = await loadPortalData(toD1Shim(seededDb()));
  const { summary, latestByTag } = data.measurements;

  assert.equal(latestByTag.length, summary.measured_tags);
  for (const row of latestByTag) {
    assert.equal(row.production_date, summary.period_end);
  }
});
