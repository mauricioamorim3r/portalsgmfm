# Fase 1 — Integração do módulo de calibração (plumbing + navegação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the standalone MPFM calibration app ("Metrolog") source into this repo under `apps/calibration/`, serve its build output at `/calibracao/` alongside Portal SGM, and add same-tab cross-navigation buttons between the two — with zero change to either app's data, calculations, or existing UI behavior.

**Architecture:** `apps/calibration/` is an independent npm project (its own `package.json`, own `npm install`/`build`/`test`, never touched by the root's locked `npm ci` / `vinext build` pipeline). Its Vite build output is committed as static files under `public/calibracao/`, which Next.js already serves verbatim at the matching URL path — no changes to `worker/index.ts` or `vite.config.ts` needed. Cross-navigation is plain `<a href>` full-page links, not client-side routing.

**Tech Stack:** Vite 8 (nested project), React 19, `lucide-react`, `xlsx`, Vitest — all already used/available; no new root dependency.

## Global Constraints

- Zero change to data, calculations, or existing UI/behavior of either app in this phase — only file relocation + two navigation links.
- `apps/calibration/` must NOT be wired into `scripts/install-ci.sh` or `scripts/build-verified.sh` — those run exactly one root `npm ci` / `vinext build`, locked to the root lockfile with integrity checks; a second nested npm project is out of scope for that pipeline in this phase.
- Raw source Excel samples never enter the repo (existing project-wide rule) — the zip's `upload/*.xlsx` sample is not copied in.
- `apps/calibration/dist/` is a build artifact, not source — do not commit it (already covered by the root `.gitignore`'s bare `dist/` pattern, which matches at any depth).
- Portuguese (pt-BR) for all new user-facing strings, per project convention.

---

### Task 1: Bring Metrolog source into `apps/calibration/`

**Files:**
- Create: `apps/calibration/package.json`
- Create: `apps/calibration/package-lock.json`
- Create: `apps/calibration/index.html`
- Create: `apps/calibration/README.md`
- Create: `apps/calibration/src/main.tsx`
- Create: `apps/calibration/src/styles.css`
- Create: `apps/calibration/src/engine.test.ts`
- Create: `apps/calibration/vite.config.ts`

**Interfaces:**
- Produces: an independent npm project at `apps/calibration/` with working `npm test` (Vitest) and `npm run build` (Vite, output at `apps/calibration/dist/`, asset URLs prefixed `/calibracao/assets/...`). Task 2 edits `apps/calibration/src/main.tsx`; Task 3 consumes `apps/calibration/dist/`.

- [ ] **Step 1: Extract the zip's app source into `apps/calibration/`, excluding the build artifact and the raw sample spreadsheet**

```bash
mkdir -p apps/calibration
cd apps/calibration
unzip -o "../../Portal_MPFM_Riser_P4_v1.zip" package.json package-lock.json index.html README.md "src/*"
cd ../..
```

Expected: `apps/calibration/` now contains `package.json`, `package-lock.json`, `index.html`, `README.md`, and `src/main.tsx`, `src/styles.css`, `src/engine.test.ts`. No `dist/` or `upload/` present (they weren't in the extraction list).

- [ ] **Step 2: Verify no stray extracted directories**

Run: `ls apps/calibration`
Expected output: `README.md  index.html  package-lock.json  package.json  src`

- [ ] **Step 3: Add `vite.config.ts` so production assets resolve under `/calibracao/`**

Create `apps/calibration/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/calibracao/",
  plugins: [react()],
});
```

- [ ] **Step 4: Install dependencies**

```bash
cd apps/calibration
npm install
cd ../..
```

Expected: exits 0, creates `apps/calibration/node_modules/` (already covered by root `.gitignore`'s bare `node_modules/` pattern — no gitignore change needed).

- [ ] **Step 5: Run the existing test suite unmodified to confirm the port didn't break anything**

Run: `cd apps/calibration && npm test`
Expected: Vitest reports the one existing suite passing — `motor metrológico > calcula K e desvios com base mássica` — `1 passed`, exit code 0.

- [ ] **Step 6: Build and verify the base path took effect**

```bash
cd apps/calibration
npm run build
grep -o '/calibracao/assets/[^"]*' dist/index.html
cd ../..
```

Expected: `npm run build` exits 0; the `grep` prints two lines matching `/calibracao/assets/index-*.js` and `/calibracao/assets/index-*.css` (exact hash suffixes vary per build — the `/calibracao/assets/` prefix is what matters).

- [ ] **Step 7: Commit**

```bash
git add apps/calibration/package.json apps/calibration/package-lock.json \
  apps/calibration/index.html apps/calibration/README.md \
  apps/calibration/src apps/calibration/vite.config.ts
git commit -m "feat: bring calibration app source into apps/calibration"
```

---

### Task 2: Add "Voltar ao Portal SGM" link inside the calibration app

**Files:**
- Modify: `apps/calibration/src/main.tsx`
- Modify: `apps/calibration/src/styles.css`

**Interfaces:**
- Consumes: `apps/calibration/src/main.tsx` as produced by Task 1 (unmodified port).
- Produces: same file, with one added link element; Task 3 rebuilds this into the `dist/` that gets copied to `public/calibracao/`.

- [ ] **Step 1: Add the link to the sidebar footer**

In `apps/calibration/src/main.tsx`, find this exact substring (inside the `<aside>` JSX, currently the last element before `</aside>`):

```tsx
<div className="version">Motor MPFM v2.1<br/>Campanha local</div>
```

Replace with:

```tsx
<div className="version">Motor MPFM v2.1<br/>Campanha local</div><a className="back-link" href="/"><Home size={15}/>Voltar ao Portal SGM</a>
```

(`Home` is already imported from `lucide-react` at the top of this file for the nav array — no import change needed.)

- [ ] **Step 2: Style the link**

Append to the end of `apps/calibration/src/styles.css` (same file, one more single-line rule, matching the file's existing minified-single-line convention):

```css
.back-link{display:flex;align-items:center;gap:7px;margin:0 22px 18px;padding:9px 10px;border:1px solid var(--line);border-radius:6px;color:#28446c;font-size:11px;text-decoration:none}.back-link:hover{background:#fff3f6;color:var(--magenta)}
```

- [ ] **Step 3: Run the test suite again (pure-logic tests, unaffected by this UI change, should still pass)**

Run: `cd apps/calibration && npm test`
Expected: `1 passed`, exit code 0 (unchanged from Task 1 — confirms the edit didn't break `calculate()`).

- [ ] **Step 4: Build and visually verify the link renders**

```bash
cd apps/calibration
npm run build
grep -o 'Voltar ao Portal SGM' dist/assets/*.js
cd ../..
```

Expected: `npm run build` exits 0; grep finds the string `Voltar ao Portal SGM` inside the built JS bundle (confirms the new markup made it into the bundle).

- [ ] **Step 5: Commit**

```bash
git add apps/calibration/src/main.tsx apps/calibration/src/styles.css
git commit -m "feat: add back-link from calibration app to Portal SGM"
```

---

### Task 3: Serve the calibration build at `/calibracao/`

**Files:**
- Create: `public/calibracao/` (copied from `apps/calibration/dist/`)

**Interfaces:**
- Consumes: `apps/calibration/dist/` as built in Task 2, Step 4.
- Produces: `public/calibracao/index.html` + `public/calibracao/assets/*`, reachable at the root dev/prod server under path `/calibracao/`. Task 6's end-to-end check depends on this being present and current.

- [ ] **Step 1: Copy the build output into `public/`**

```bash
rm -rf public/calibracao
mkdir -p public/calibracao
cp -r apps/calibration/dist/. public/calibracao/
```

- [ ] **Step 2: Verify the copied `index.html` references the `/calibracao/` prefix**

Run: `grep -o '/calibracao/assets/[^"]*' public/calibracao/index.html`
Expected: two matches (JS and CSS), same as Task 1 Step 6.

- [ ] **Step 3: Start the root dev server and confirm the route is served**

```bash
export WRANGLER_LOG_PATH=.wrangler/wrangler.log
npx vite &
sleep 6
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/calibracao/
curl -s http://localhost:5173/calibracao/ | grep -o 'Voltar ao Portal SGM\|METROLOG' | sort -u
```

(If port 5173 is occupied, Vite prints the fallback port it picked — substitute that port in the `curl` calls.)

Expected: first `curl` prints `200`; second prints both `METROLOG` and `Voltar ao Portal SGM` (confirms the calibration app's shell and Task 2's new link are both present in the served HTML/JS).

- [ ] **Step 4: Stop the dev server**

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 5: Commit**

```bash
git add public/calibracao
git commit -m "build: serve calibration app static build at /calibracao/"
```

---

### Task 4: Add "Calibração MPFM" link inside Portal SGM

**Files:**
- Modify: `src/components/portal/PortalApp.jsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `src/components/portal/PortalApp.jsx` as it exists today (aside footer with `.asideFoot` block).
- Produces: same file, with one added link element after `.asideFoot`; no other component depends on this change.

- [ ] **Step 1: Add the `Gauge` icon to the existing lucide-react import**

In `src/components/portal/PortalApp.jsx`, find:

```jsx
import { Activity, PanelLeftClose, Search } from "lucide-react";
```

Replace with:

```jsx
import { Activity, Gauge, PanelLeftClose, Search } from "lucide-react";
```

- [ ] **Step 2: Add the link after the existing `.asideFoot` block**

Find:

```jsx
      <div className="asideFoot"><Activity size={18}/><div><b>Ambiente restrito</b><small>Somente fontes reais</small></div></div>
    </aside>
```

Replace with:

```jsx
      <div className="asideFoot"><Activity size={18}/><div><b>Ambiente restrito</b><small>Somente fontes reais</small></div></div>
      <a className="calibLink" href="/calibracao/"><Gauge size={18}/><div><b>Calibração MPFM</b><small>Abrir motor de cálculo</small></div></a>
    </aside>
```

- [ ] **Step 3: Style the link to match the existing `.asideFoot` block**

Append to `app/globals.css` (same file, one more rule in its existing single-line-per-block style):

```css
.calibLink{margin:10px 8px 0;border-top:1px solid #e4e7eb;padding:14px 8px 0;display:flex;gap:9px;align-items:center;text-decoration:none;color:inherit}.calibLink b{font-size:10px;color:#0b2248}.calibLink small{color:#8490a3;font-size:9px;margin-top:3px;display:block}.calibLink:hover b{color:#ec1742}
```

- [ ] **Step 4: Build the root app and confirm it still compiles**

```bash
npm run build
```

Expected: exits 0 (same bounded `vinext build` used today — this task only touched JSX/CSS, no logic).

- [ ] **Step 5: Commit**

```bash
git add src/components/portal/PortalApp.jsx app/globals.css
git commit -m "feat: add Calibração MPFM link to Portal SGM sidebar"
```

---

### Task 5: Update docs and remove the now-redundant zip

**Files:**
- Modify: `CLAUDE.md`
- Delete: `Portal_MPFM_Riser_P4_v1.zip`

**Interfaces:**
- Consumes: nothing from earlier tasks (docs-only).
- Produces: updated project documentation; no code dependency.

- [ ] **Step 1: Update the "Calibration domain" section of `CLAUDE.md`**

Find this paragraph:

```markdown
Separate from the continuous-production tables (`mpfm_measurements`, etc.): a
calibration campaign is a bounded, per-TAG K-factor commissioning/verification
event (AS_FOUND/POST_K windows), not a stream of ongoing readings. Added
2026-07-14 to feed the standalone MPFM calibration engine from
`Portal_MPFM_Riser_P4_v1.zip` (16-gate metrology workflow, `calculate()` in
its `src/main.tsx`) — that app is **not** part of this repo and its front-end
was intentionally not touched. `db/calibration.ts` → `loadCalibrationCampaign`
returns a payload shaped to match that engine's `Campaign`/`Row` types field
for field, so it can be fed to `calculate()` with no reshaping. Fields the v1
engine doesn't consume yet (separator, lab, PVT/K/uncertainty detail) still
come back under `campaign.raw` for traceability and future engine versions.
The source Excel/zip stay out of the repo (same "no raw source docs" policy
as `docs/source-selection.md`) — only derived numeric rows are committed, via
`scripts/import-mpfm-calibration.py`.
```

Replace with:

```markdown
Separate from the continuous-production tables (`mpfm_measurements`, etc.): a
calibration campaign is a bounded, per-TAG K-factor commissioning/verification
event (AS_FOUND/POST_K windows), not a stream of ongoing readings. Added
2026-07-14 to feed the MPFM calibration engine (16-gate metrology workflow,
`calculate()` in `apps/calibration/src/main.tsx`) — as of Phase 1
(2026-07-14) that engine's front-end lives in this repo under
`apps/calibration/`, but as its own independent npm project: its
`npm install`/`build`/`test` run from inside that directory and are **not**
wired into the root's `scripts/install-ci.sh` / `scripts/build-verified.sh`.
Its build output is committed as static files under `public/calibracao/` and
served at `/calibracao/` by the same Next.js static-file handling that already
serves `public/favicon.svg` — no Worker or Vite routing changes needed. Portal
SGM and the calibration app link to each other (sidebar buttons) but stay
independent SPAs — no shared React tree, no shared CSS, no shared client
state. `db/calibration.ts` → `loadCalibrationCampaign` returns a payload
shaped to match that engine's `Campaign`/`Row` types field for field, so it
can be fed to `calculate()` with no reshaping (still read-only via
`GET /api/calibration` as of Phase 1 — write-back is Phase 2). Fields the v1
engine doesn't consume yet (separator, lab, PVT/K/uncertainty detail) still
come back under `campaign.raw` for traceability and future engine versions.
Raw source Excel samples still stay out of the repo (same "no raw source
docs" policy as `docs/source-selection.md`) — only derived numeric rows are
committed, via `scripts/import-mpfm-calibration.py`.
```

- [ ] **Step 2: Add `apps/calibration/` to the Project Structure listing**

Find:

```
scripts/import-mpfm-calibration.py  Calibration campaign Excel → D1 import (calibration_* tables)
```

Replace with:

```
scripts/import-mpfm-calibration.py  Calibration campaign Excel → D1 import (calibration_* tables)
apps/calibration/                Standalone MPFM calibration engine (own npm project — see below)
public/calibracao/               Built static output of apps/calibration/, served at /calibracao/
```

- [ ] **Step 3: Document the manual deploy-copy workflow in `apps/calibration/README.md`**

Append to the end of `apps/calibration/README.md`:

```markdown

## Publicar no Portal SGM

Este app não faz parte do pipeline de build do Portal SGM. Depois de mudar
algo em `src/`, gere o build e copie a saída pra dentro do repo do Portal:

```bash
npm run build
rm -rf ../../public/calibracao
mkdir -p ../../public/calibracao
cp -r dist/. ../../public/calibracao/
```

Depois, commite `public/calibracao/` junto com sua mudança em `src/`.
```

- [ ] **Step 4: Delete the now-redundant zip**

```bash
git rm Portal_MPFM_Riser_P4_v1.zip
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md apps/calibration/README.md
git commit -m "docs: reflect calibration app living in-repo under apps/calibration"
```

---

### Task 6: End-to-end verification of both cross-navigation directions

**Files:** none (verification only)

**Interfaces:**
- Consumes: everything from Tasks 1–5 together, running as one system.
- Produces: confirmation the phase's goal (working cross-navigation, zero regressions) is actually met.

- [ ] **Step 1: Start the root dev server**

```bash
export WRANGLER_LOG_PATH=.wrangler/wrangler.log
npx vite &
sleep 6
```

- [ ] **Step 2: Confirm Portal SGM's home page still serves and contains the new link**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
curl -s http://localhost:5173/ | grep -o 'Calibração MPFM'
```

Expected: `200`, then `Calibração MPFM` printed once.

- [ ] **Step 3: Confirm the calibration route still serves and contains the return link**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/calibracao/
curl -s http://localhost:5173/calibracao/ | grep -o 'Voltar ao Portal SGM'
```

Expected: `200`, then `Voltar ao Portal SGM` printed once.

- [ ] **Step 4: Confirm `apps/calibration`'s own test suite still passes standalone**

```bash
cd apps/calibration && npm test && cd ../..
```

Expected: `1 passed`, exit code 0.

- [ ] **Step 5: Confirm the root test suite is unaffected**

```bash
npm test
```

Expected: exits 0 — same pass count as before this phase started (this phase touched no root `db/*`, `app/api/*`, or `tests/*` files).

- [ ] **Step 6: Stop the dev server**

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 7: Final status check — nothing uncommitted, nothing stray**

```bash
git status -sb
```

Expected: clean (only `## main...origin/main [ahead N]` — no untracked or modified files).
