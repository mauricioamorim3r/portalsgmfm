import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const quality = JSON.parse(
  await readFile(new URL("../src/data/oil-linear-quality.json", import.meta.url), "utf8"),
);

test("keeps only aggregate Oil Linear quality metadata", () => {
  assert.equal(quality.meta.dataset, "Óleo Linear");
  assert.equal(quality.meta.containsRawMeasurements, false);
  assert.equal(quality.profile.rows, 876);
  assert.equal(quality.profile.columns, 114);
  assert.equal(quality.profile.tags, 4);
  assert.equal(quality.checks.duplicateRows, 0);
  assert.equal(quality.byTag.length, 4);
  assert.ok(!("records" in quality));
});

test("does not classify zero measurements as metrological failures", () => {
  const stableZero = quality.classifications.find(
    (item) => item.code === "zero_stable_totalizer_pt_zero",
  );

  assert.equal(stableZero.count, 376);
  assert.equal(stableZero.status, "Não avaliável");
  assert.match(stableZero.rule, /não é classificado como falha automaticamente/i);
  assert.ok(quality.limitations.some((item) => /Conforme/.test(item)));
});
