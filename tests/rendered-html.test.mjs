import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const portalDir = new URL("../src/components/portal/", import.meta.url);
const files = (await readdir(portalDir)).filter((name) => name.endsWith(".jsx") || name.endsWith(".js"));
const sources = await Promise.all(files.map((name) => readFile(new URL(name, portalDir), "utf8")));
const portal = sources.join("\n");

test("the Portal shell reads the operational API", () => {
  assert.match(portal, /fetch\("\/api\/portal-data"/);
  assert.match(portal, /Somente fontes reais/);
  assert.match(portal, /Nenhum número demonstrativo será exibido/);
});

test("the Portal no longer embeds the former demonstration values", () => {
  for (const forbidden of ["97,6%", "98,3%", "PE04-2026-01", "Dados demonstrativos"]) {
    assert.doesNotMatch(portal, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});
