import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const schema = await readFile(new URL("../drizzle/0000_big_queen_noir.sql", import.meta.url), "utf8");
const seed = await readFile(new URL("../drizzle/0001_real_source_data.sql", import.meta.url), "utf8");

test("real source migration is traceable and internally consistent", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(schema);
  db.exec(seed);

  const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  assert.equal(count("source_files"), 5);
  assert.equal(count("measurement_points"), 71);
  assert.equal(count("wells"), 44);
  assert.equal(count("mpfm_measurements"), 4584);
  assert.equal(count("separator_measurements"), 3075);

  const mpfm = db.prepare("SELECT MIN(production_date) AS start, MAX(production_date) AS end, COUNT(DISTINCT tag) AS tags FROM mpfm_measurements").get();
  assert.equal(mpfm.start, "2026-06-01");
  assert.equal(mpfm.end, "2026-07-10");
  assert.equal(mpfm.tags, 6);
  const separator = db.prepare("SELECT COUNT(DISTINCT production_date) AS days, COUNT(DISTINCT phase) AS phases FROM separator_measurements").get();
  assert.equal(separator.days, 41);
  assert.equal(separator.phases, 3);
  db.close();
});
