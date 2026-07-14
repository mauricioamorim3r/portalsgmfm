import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.jsx", import.meta.url), "utf8");

test("the Portal shell reads the operational API", () => {
  assert.match(page, /fetch\("\/api\/portal-data"/);
  assert.match(page, /Somente fontes reais/);
  assert.match(page, /Nenhum número demonstrativo será exibido/);
});

test("the Portal no longer embeds the former demonstration values", () => {
  for (const forbidden of ["97,6%", "98,3%", "PE04-2026-01", "Dados demonstrativos"]) {
    assert.doesNotMatch(page, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});
