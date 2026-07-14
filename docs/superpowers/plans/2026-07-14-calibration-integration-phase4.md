# Fase 4 — Criar campanha de calibração do zero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `POST /api/calibration` to create a new campaign from scratch, and a "Solicitar calibração" modal in the calibration app that collects the basic fields and calls it.

**Architecture:** `createCalibrationCampaign` in `db/calibration-write.ts` reuses the same PVT/K/uncertainty upsert SQL constants `saveCalibrationCampaign` (Fase 2) already defines — it inserts the campaign row (capturing the new row's id via `.run()`, a method D1 already provides natively that we're adding to our minimal `D1Statement` type), then runs the same upsert batch with empty/zero values so every related table has a row from creation onward. The route handler reuses the existing `parseCampaignInput` validator. The frontend modal follows the exact same visual pattern as the existing `Drawer` component.

**Tech Stack:** TypeScript, D1 (`.run()` for the insert, `.batch()` for the related-table upserts — same pattern as Fase 2), React 19, TSX.

## Global Constraints

- Reuse `CampaignInput` and the existing `UPSERT_PVT_SQL`/`UPSERT_K_OLEO_SQL`/`UPSERT_K_SIMPLE_SQL`/`UPSERT_UNCERTAINTY_SQL` constants in `db/calibration-write.ts` — do not duplicate them.
- `campaign_id` uniqueness is the only real constraint on creation — a second creation attempt with the same id must fail with `409`, never silently overwrite (that's what `PUT` is for).
- No new validation library — creation body validation reuses the existing `parseCampaignInput` in `app/api/calibration/route.ts`.
- Portuguese (pt-BR) for all new user-facing strings.
- No campaign-list/switcher UI — out of scope for this phase (see spec).

---

### Task 1: `.run()` on `D1Statement`

**Files:**
- Modify: `db/portal-data.ts`

**Interfaces:**
- Produces: `D1Statement.bind(...).run<T>(): Promise<T>`, consumed by Task 2's `createCalibrationCampaign`.

- [ ] **Step 1: Add `run` to the bind-result type**

Find:

```ts
export interface D1Statement {
  bind(...values: unknown[]): {
    all<T = unknown>(): Promise<{ results?: T[] }>;
    first<T = unknown>(): Promise<T | null>;
  };
}
```

Replace with:

```ts
export interface D1Statement {
  bind(...values: unknown[]): {
    all<T = unknown>(): Promise<{ results?: T[] }>;
    first<T = unknown>(): Promise<T | null>;
    run<T = unknown>(): Promise<T>;
  };
}
```

- [ ] **Step 2: Verify existing code still compiles**

Run: `npm run build`
Expected: exits 0 (purely additive — nothing currently calls `.run()` at the type level, and real D1's `D1PreparedStatement` already has this method natively, so no cast is needed anywhere).

- [ ] **Step 3: Commit**

```bash
git add db/portal-data.ts
git commit -m "feat: add run() to D1Statement type for insert-then-batch writes"
```

---

### Task 2: `createCalibrationCampaign` — test-first

**Files:**
- Modify: `db/calibration-write.ts`
- Modify: `tests/calibration-write.test.mjs`

**Interfaces:**
- Consumes: `D1Batchable`/`D1Statement.run()` (Task 1); the existing `UPSERT_PVT_SQL`/`UPSERT_K_OLEO_SQL`/`UPSERT_K_SIMPLE_SQL`/`UPSERT_UNCERTAINTY_SQL` constants already in this file.
- Produces: `createCalibrationCampaign(db: D1Batchable, input: CampaignInput): Promise<{ ok: true; id: number } | { ok: false; reason: "conflict" }>`, consumed by Task 3's `POST` handler.

- [ ] **Step 1: Extend the test shim's `run()` to capture the inserted row's id**

In `tests/calibration-write.test.mjs`, find:

```js
            async run() {
              stmt.run(...values);
              return { success: true };
            },
```

Replace with:

```js
            async run() {
              const info = stmt.run(...values);
              return { success: true, meta: { last_row_id: Number(info.lastInsertRowid) } };
            },
```

- [ ] **Step 2: Add the new import and the failing tests**

Find:

```js
import { saveCalibrationCampaign } from "../db/calibration-write.ts";
```

Replace with:

```js
import { saveCalibrationCampaign, createCalibrationCampaign } from "../db/calibration-write.ts";
```

Then, at the end of the file, add:

```js

function blankInput(id) {
  return {
    id, revision: "Rev. 0", nature: "COMISSIONAMENTO", asset: "", well: "", tag: "99XX9999",
    serial: "", reference: "", start: null, end: null, postStart: null, postEnd: null,
    pb: null, hcLimit: null, totalLimit: null, pvtLimit: null, kMin: null, kMax: null,
    minRecords: null, pvtMonths: null, timezone: "", responsible: "", approver: "",
    envelope: { p: [null, null], t: [null, null], dp: [null, null], gvf: [null, null], wlr: [null, null] },
    pvt: { asOil: null, asGas: null, asWater: null, postOil: null, postGas: null, postWater: null, file: "", hash: "", software: "", version: "", approver: "" },
    uncertainty: { asMpfm: null, asRef: null, postMpfm: null, postRef: null },
    k: { oilApproved: null, gasApproved: null, waterApproved: null, oilApplied: null, gasApplied: null, waterApplied: null, date: "", responsible: "", evidence: "" },
    evidence: false,
    approvals: false,
  };
}

test("createCalibrationCampaign creates a new campaign with empty related rows ready for upsert", async () => {
  const db = toD1Shim(await seededDb());
  const result = await createCalibrationCampaign(db, blankInput("NOVA-CAMPANHA-001"));
  assert.equal(result.ok, true);
  assert.equal(typeof result.id, "number");

  const campaign = await loadCalibrationCampaign(db, "NOVA-CAMPANHA-001");
  assert.equal(campaign.tag, "99XX9999");
  assert.equal(campaign.nature, "COMISSIONAMENTO");
  assert.deepEqual(campaign.envelope.p, [null, null]);
  // Related tables have a row already (not just column defaults from a missing row) —
  // confirms the creation batch ran, not just the campaign insert.
  assert.equal(campaign.raw.pvtRecords.length, 2);
  assert.equal(campaign.raw.kApplications.length, 3);
  assert.equal(campaign.raw.uncertaintyRows.length, 2);
});

test("createCalibrationCampaign returns conflict for a campaign_id that already exists", async () => {
  const db = toD1Shim(await seededDb());
  const result = await createCalibrationCampaign(db, blankInput("RVD-MPFM-COM-05-26"));
  assert.deepEqual(result, { ok: false, reason: "conflict" });
});
```

- [ ] **Step 3: Run the test file to confirm the two new tests fail (function doesn't exist yet)**

Run: `node --test tests/calibration-write.test.mjs`
Expected: FAIL — `createCalibrationCampaign is not a function` (or equivalent import error), for the two new tests; the 5 pre-existing tests still pass.

- [ ] **Step 4: Implement `createCalibrationCampaign`**

In `db/calibration-write.ts`, at the end of the file (after `saveCalibrationCampaign`), add:

```ts

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
```

- [ ] **Step 5: Run the test file again to confirm all 7 tests pass**

Run: `node --test tests/calibration-write.test.mjs`
Expected: PASS — 7 tests (5 from Fase 2 + 2 new), 0 failures.

- [ ] **Step 6: Run the full root test suite**

Run: `npm test`
Expected: PASS — exit code 0.

- [ ] **Step 7: Commit**

```bash
git add db/calibration-write.ts tests/calibration-write.test.mjs
git commit -m "feat: add createCalibrationCampaign for creating campaigns from the app"
```

---

### Task 3: `POST /api/calibration` route handler

**Files:**
- Modify: `app/api/calibration/route.ts`

**Interfaces:**
- Consumes: `createCalibrationCampaign` from `db/calibration-write.ts` (Task 2); existing `parseCampaignInput`, `loadCalibrationCampaign`, `corsHeaders`.
- Produces: the live `POST` endpoint, consumed by Task 4's frontend modal.

- [ ] **Step 1: Import `createCalibrationCampaign`**

Find:

```ts
import { saveCalibrationCampaign, type CampaignInput } from "../../../db/calibration-write";
```

Replace with:

```ts
import { saveCalibrationCampaign, createCalibrationCampaign, type CampaignInput } from "../../../db/calibration-write";
```

- [ ] **Step 2: Announce `POST` in `OPTIONS`**

Find:

```ts
      "Access-Control-Allow-Methods": "GET, PUT",
```

Replace with:

```ts
      "Access-Control-Allow-Methods": "GET, PUT, POST",
```

- [ ] **Step 3: Add the `POST` handler**

At the end of `app/api/calibration/route.ts` (after the existing `PUT` function), add:

```ts

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  try {
    if (!env.DB) {
      return Response.json({ status: "unavailable", error: "Base D1 não vinculada." }, { status: 503, headers });
    }

    const body = await request.json().catch(() => null);
    const input = parseCampaignInput(body);
    if (!input) {
      return Response.json({ status: "error", error: "Corpo da requisição inválido." }, { status: 400, headers });
    }

    const result = await createCalibrationCampaign(env.DB, input);
    if (!result.ok) {
      return Response.json({ status: "error", error: `Já existe uma campanha com o Campaign ID "${input.id}".` }, { status: 409, headers });
    }

    const campaign = await loadCalibrationCampaign(env.DB, input.id);
    return Response.json({ status: "ok", campaign }, { status: 201, headers });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    const message = /no such table|D1_ERROR/i.test(detail)
      ? "A base real ainda não foi inicializada neste ambiente. A migração será aplicada na publicação."
      : "Falha ao criar a campanha na base real.";
    return Response.json({ status: "error", error: message }, { status: 500, headers });
  }
}
```

- [ ] **Step 4: Build and test the root app**

```bash
npm run build
npm test
```

Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/api/calibration/route.ts
git commit -m "feat: add POST handler to create calibration campaigns"
```

---

### Task 4: "Solicitar calibração" modal in the calibration app

**Files:**
- Modify: `apps/calibration/src/main.tsx`
- Modify: `apps/calibration/src/styles.css`

**Interfaces:**
- Consumes: `POST /api/calibration` (Task 3), via same-origin relative `fetch()` (same pattern as `save()`).
- Produces: no new interface consumed elsewhere — this is the last piece.

- [ ] **Step 1: Add the `Plus` icon to the lucide-react import**

Find:

```tsx
import {Activity, AlertTriangle, BarChart3, Beaker, Check, CheckCircle2, ChevronRight, ClipboardCheck, Database, Download, Droplets, FileCheck2, FileSpreadsheet, Gauge, Home, Import, Menu, Save, Settings2, ShieldAlert, SlidersHorizontal, Upload, X, XCircle} from 'lucide-react';
```

Replace with:

```tsx
import {Activity, AlertTriangle, BarChart3, Beaker, Check, CheckCircle2, ChevronRight, ClipboardCheck, Database, Download, Droplets, FileCheck2, FileSpreadsheet, Gauge, Home, Import, Menu, Plus, Save, Settings2, ShieldAlert, SlidersHorizontal, Upload, X, XCircle} from 'lucide-react';
```

- [ ] **Step 2: Add `novaCampanha` state, right after the existing `useState` line**

Find:

```tsx
 const [c,setC]=useState<Campaign>(()=>{try{return JSON.parse(localStorage.getItem('mpfm-campaign')||'null')||initial}catch{return initial}}),[active,setActive]=useState('Visão geral'),[drawer,setDrawer]=useState(false),[toast,setToast]=useState(''),[mobile,setMobile]=useState(false); const fileRef=useRef<HTMLInputElement>(null); const r=useMemo(()=>calculate(c),[c]);
```

Replace with:

```tsx
 const [c,setC]=useState<Campaign>(()=>{try{return JSON.parse(localStorage.getItem('mpfm-campaign')||'null')||initial}catch{return initial}}),[active,setActive]=useState('Visão geral'),[drawer,setDrawer]=useState(false),[toast,setToast]=useState(''),[mobile,setMobile]=useState(false),[novaCampanha,setNovaCampanha]=useState(false); const fileRef=useRef<HTMLInputElement>(null); const r=useMemo(()=>calculate(c),[c]);
```

- [ ] **Step 3: Add the "+" button next to the campaign selector, and render the modal**

Find:

```tsx
<div className="selector"><small>Campanha ativa</small><b>{c.id} | {c.asset} | P4</b></div><span className="sync"><CheckCircle2 size={17}/> Sincronizado localmente</span>
```

Replace with:

```tsx
<div className="selector"><small>Campanha ativa</small><b>{c.id} | {c.asset} | P4</b></div><button className="icon" title="Solicitar nova calibração" onClick={()=>setNovaCampanha(true)}><Plus size={17}/></button><span className="sync"><CheckCircle2 size={17}/> Sincronizado localmente</span>
```

Then find:

```tsx
{drawer&&<Drawer c={c} update={update} close={()=>setDrawer(false)} save={()=>{save();setDrawer(false)}}/>}{toast&&<div className="toast"><CheckCircle2/>{toast}</div>}</div>}
```

Replace with:

```tsx
{drawer&&<Drawer c={c} update={update} close={()=>setDrawer(false)} save={()=>{save();setDrawer(false)}}/>}{novaCampanha&&<NovaCampanhaModal close={()=>setNovaCampanha(false)} onCreated={created=>{setC(created);localStorage.setItem('mpfm-campaign',JSON.stringify(created));setNovaCampanha(false);setActive('Campanha');flash('Campanha criada. Continue o preenchimento na aba Campanha.')}}/>}{toast&&<div className="toast"><CheckCircle2/>{toast}</div>}</div>}
```

- [ ] **Step 4: Add `blankCampaign` and `NovaCampanhaModal`, right after `function Drawer`'s closing line**

Find:

```tsx
function Drawer({c,update,close,save}:{c:Campaign,update:(k:keyof Campaign,v:any)=>void,close:()=>void,save:()=>void}){const field=(label:string,key:keyof Campaign,type='text',unit='')=><label><span>{label}<i>*</i></span><div><input type={type} value={String(c[key]??'')} onChange={e=>update(key,type==='number'?Number(e.target.value):e.target.value)}/>{unit&&<em>{unit}</em>}</div></label>;return <><div className="drawer-scrim" onClick={close}/><aside className="drawer"><header><div><h2>Detalhes da campanha</h2><p>Informações gerais e critérios</p></div><button onClick={close}><X/></button></header><div className="form">{field('Campaign ID','id')}{field('Ativo / instalação','asset')}{field('Poço / Riser','well')}{field('TAG do MPFM','tag')}{field('Número de série','serial')}{field('Referência autorizada','reference')}{field('Pressão de bolha','pb','number','barg')}{field('Limite de desvio HC','hcLimit','number','fração')}{field('Limite de desvio total','totalLimit','number','fração')}{field('Timezone','timezone')}{field('Responsável técnico','responsible')}{field('Aprovador','approver')}<div className="validation"><CheckCircle2/><span><b>Validação imediata</b><small>Campos vazios são refletidos automaticamente nos gates.</small></span></div></div><footer><button onClick={close}>Cancelar</button><button className="primary" onClick={save}><Save/>Salvar</button></footer></aside></>}
```

Insert immediately after that line (before the final `if(typeof document!=='undefined')...` bootstrap line):

```tsx
function blankCampaign(id:string):Campaign{
 return {id,revision:'',nature:'',asset:'',well:'',tag:'',serial:'',type:'',reference:'',start:'',end:'',postStart:'',postEnd:'',pb:0,hcLimit:0,totalLimit:0,pvtLimit:0,kMin:0,kMax:0,minRecords:0,pvtMonths:0,timezone:'',responsible:'',approver:'',envelope:{p:[null,null],t:[null,null],dp:[null,null],gvf:[null,null],wlr:[null,null]},pvt:{asOil:0,asGas:0,asWater:0,postOil:0,postGas:0,postWater:0,file:'',hash:'',software:'',version:'',approver:''},uncertainty:{asMpfm:0,asRef:0,postMpfm:0,postRef:0},k:{oilApproved:0,gasApproved:0,waterApproved:0,oilApplied:0,gasApplied:0,waterApplied:0,date:'',responsible:'',evidence:''},integrity:{raw:false,dp:false,units:false,timezone:false,gaps:false,exclusions:false},evidence:false,approvals:false,rows:[]}
}
function NovaCampanhaModal({close,onCreated}:{close:()=>void,onCreated:(c:Campaign)=>void}){
 const [form,setForm]=useState({id:'',asset:'',well:'',tag:'',serial:'',reference:'',revision:'Rev. 0',nature:'COMISSIONAMENTO',responsible:'',approver:''});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const set=(key:keyof typeof form,value:string)=>setForm(x=>({...x,[key]:value}));
 const field=(label:string,key:keyof typeof form)=><label><span>{label}<i>*</i></span><div><input type="text" value={form[key]} onChange={e=>set(key,e.target.value)}/></div></label>;
 const submit=async()=>{
  if(!form.id||!form.tag){setError('Campaign ID e TAG são obrigatórios.');return}
  setBusy(true);setError('');
  const body={...blankCampaign(form.id),asset:form.asset,well:form.well,tag:form.tag,serial:form.serial,reference:form.reference,revision:form.revision,nature:form.nature,responsible:form.responsible,approver:form.approver};
  try{
   const res=await fetch('/api/calibration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const data=await res.json();
   if(!res.ok||data.status!=='ok'){setError(data.error||'Falha ao criar campanha.');setBusy(false);return}
   onCreated(data.campaign);
  }catch{setError('Base real indisponível — não foi possível criar a campanha.');setBusy(false)}
 };
 return <><div className="drawer-scrim" onClick={close}/><aside className="drawer"><header><div><h2>Solicitar calibração</h2><p>Dados básicos da nova campanha</p></div><button onClick={close}><X/></button></header><div className="form">{field('Campaign ID','id')}{field('Ativo / instalação','asset')}{field('Poço / Riser','well')}{field('TAG do MPFM','tag')}{field('Número de série','serial')}{field('Referência autorizada','reference')}{field('Revisão','revision')}{field('Natureza','nature')}{field('Responsável técnico','responsible')}{field('Aprovador','approver')}{error&&<p className="form-error">{error}</p>}</div><footer><button onClick={close}>Cancelar</button><button className="primary" onClick={submit} disabled={busy}><Save/>{busy?'Criando…':'Criar campanha'}</button></footer></aside></>
}
```

- [ ] **Step 5: Add the `.form-error` CSS rule**

Append to the end of `apps/calibration/src/styles.css`:

```css
.form-error{color:var(--red);font-size:11px;margin:8px 0 0}
```

- [ ] **Step 6: Run the calibration app's own test suite**

Run: `cd apps/calibration && npm test`
Expected: `1 passed` — unchanged.

- [ ] **Step 7: Build**

```bash
cd apps/calibration
npm run build
cd ../..
```

Expected: exits 0.

- [ ] **Step 8: Copy the rebuilt output into `public/calibracao/`**

```bash
rm -rf public/calibracao
mkdir -p public/calibracao
cp -r apps/calibration/dist/. public/calibracao/
```

- [ ] **Step 9: Commit**

```bash
git add apps/calibration/src/main.tsx apps/calibration/src/styles.css public/calibracao
git commit -m "feat: add Solicitar calibracao modal to create campaigns from the app"
```

---

### Task 5: End-to-end verification and docs

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: everything from Tasks 1-4 running together.
- Produces: confirmation the phase goal is met, plus accurate docs.

- [ ] **Step 1: Update `CLAUDE.md`'s Calibration domain paragraph**

Find (the sentence added in Fase 2 about the write API):

```markdown
As of Phase 2 (2026-07-14),
`PUT /api/calibration?campaignId=` (`db/calibration-write.ts` →
`saveCalibrationCampaign`) persists edits back to the same tables — scoped to
exactly the fields the engine's `Campaign` type carries (scalar fields,
envelope, PVT, K-factors, uncertainty, evidence/approvals). It only updates
an existing campaign (404 if not found) — creating a campaign is still
exclusively `scripts/import-mpfm-calibration.py`'s job. `rows` (MPFM/
separator readings) and everything under `campaign.raw` stay read-only/
import-only. The Metrolog app's "Salvar" button calls this endpoint (same
origin as of Phase 1) in addition to its existing `localStorage` save.
```

Replace with:

```markdown
As of Phase 2 (2026-07-14),
`PUT /api/calibration?campaignId=` (`db/calibration-write.ts` →
`saveCalibrationCampaign`) persists edits back to the same tables — scoped to
exactly the fields the engine's `Campaign` type carries (scalar fields,
envelope, PVT, K-factors, uncertainty, evidence/approvals). `rows` (MPFM/
separator readings) and everything under `campaign.raw` stay read-only/
import-only — no in-app path writes those yet. The Metrolog app's "Salvar"
button calls this endpoint (same origin as of Phase 1) in addition to its
existing `localStorage` save. As of Phase 4 (2026-07-14), `POST
/api/calibration` (`createCalibrationCampaign`) creates a brand-new campaign
from the app itself, via a "Solicitar calibração" modal — `scripts/
import-mpfm-calibration.py` remains available for bulk/offline creation but
is no longer the only path.
```

- [ ] **Step 2: Start the root dev server**

```bash
export WRANGLER_LOG_PATH=.wrangler/wrangler.log
npx vite &
sleep 6
```

- [ ] **Step 3: Confirm creating a new campaign via the real HTTP endpoint**

```bash
curl -s -X POST "http://localhost:5173/api/calibration" \
  -H "Content-Type: application/json" \
  --data-binary '{"id":"VERIFICACAO-E2E-FASE4","revision":"Rev. 0","nature":"COMISSIONAMENTO","asset":"Teste","well":"Teste","tag":"00XX0000","serial":"","reference":"","start":null,"end":null,"postStart":null,"postEnd":null,"pb":null,"hcLimit":null,"totalLimit":null,"pvtLimit":null,"kMin":null,"kMax":null,"minRecords":null,"pvtMonths":null,"timezone":"","responsible":"","approver":"","envelope":{"p":[null,null],"t":[null,null],"dp":[null,null],"gvf":[null,null],"wlr":[null,null]},"pvt":{"asOil":null,"asGas":null,"asWater":null,"postOil":null,"postGas":null,"postWater":null,"file":"","hash":"","software":"","version":"","approver":""},"uncertainty":{"asMpfm":null,"asRef":null,"postMpfm":null,"postRef":null},"k":{"oilApproved":null,"gasApproved":null,"waterApproved":null,"oilApplied":null,"gasApplied":null,"waterApplied":null,"date":"","responsible":"","evidence":""},"evidence":false,"approvals":false}' \
  -w "\n%{http_code}\n"
```

Expected: JSON body with `"status":"ok"` and the created campaign, ending in `201`.

- [ ] **Step 4: Confirm creating the same id again returns 409**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "http://localhost:5173/api/calibration" \
  -H "Content-Type: application/json" \
  --data-binary '{"id":"VERIFICACAO-E2E-FASE4","revision":"","nature":"","asset":"","well":"","tag":"X","serial":"","reference":"","start":null,"end":null,"postStart":null,"postEnd":null,"pb":null,"hcLimit":null,"totalLimit":null,"pvtLimit":null,"kMin":null,"kMax":null,"minRecords":null,"pvtMonths":null,"timezone":"","responsible":"","approver":"","envelope":{"p":[null,null],"t":[null,null],"dp":[null,null],"gvf":[null,null],"wlr":[null,null]},"pvt":{"asOil":null,"asGas":null,"asWater":null,"postOil":null,"postGas":null,"postWater":null,"file":"","hash":"","software":"","version":"","approver":""},"uncertainty":{"asMpfm":null,"asRef":null,"postMpfm":null,"postRef":null},"k":{"oilApproved":null,"gasApproved":null,"waterApproved":null,"oilApplied":null,"gasApplied":null,"waterApplied":null,"date":"","responsible":"","evidence":""},"evidence":false,"approvals":false}'
```

Expected: `409`.

- [ ] **Step 5: Confirm the modal works live**

Navigate to `http://localhost:5173/calibracao/`, click the "+" button next to "Campanha ativa", fill Campaign ID + TAG, click "Criar campanha", confirm the app switches to the new campaign and lands on the Campanha tab with a success toast.

- [ ] **Step 6: Stop the dev server**

```powershell
Get-NetTCPConnection -LocalPort 5173 -State Listen | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }
```

- [ ] **Step 7: Run both test suites once more**

```bash
npm test
cd apps/calibration && npm test && cd ../..
```

Expected: both exit 0.

- [ ] **Step 8: Commit the docs update**

```bash
git add CLAUDE.md
git commit -m "docs: reflect the calibration campaign-creation flow landing in Phase 4"
```

- [ ] **Step 9: Final status check**

```bash
git status -sb
```

Expected: clean (only the branch-tracking line).
