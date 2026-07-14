# Fase 3.2 — Grupo B: MPFM, Separador, Evidências, Laboratório/PVT (parte lab) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 3 more "em construção" tabs (MPFM, Separador, Evidências) with real read-only views over data already loaded by Fase 3.1.5's fetch, and extend the existing Laboratório/PVT tab with a read-only lab-results table.

**Architecture:** A new `numOrDash` formatting helper (for the nullable numeric fields on `SeparatorRow`/`LabResult`) and generic `table`/`.table-wrap` CSS (this app has never rendered a table before). Three new read-only tab components (`MPFMTab`, `SeparadorTab`, `EvidenciasTab`) plus one extension to the existing `LaboratorioPvtTab`. No new state, no new API calls, no new writes — pure display over `c.rows` and `c.raw?.*`, which Fase 3.1.5 already populates from the real `GET /api/calibration` response.

**Tech Stack:** React 19, TSX — no new dependencies.

## Global Constraints

- These 4 tabs are **read-only** — no form inputs, no "Salvar" button, no new write path. Row-level MPFM/separator/lab data only ever enters the database via `scripts/import-mpfm-calibration.py`, run outside this app — this was an explicit decision, not an oversight.
- Every table shows an honest empty state ("Nenhum registro carregado ainda.") when its source array is empty or absent — never a fabricated row.
- `c.raw` is optional (`raw?` — Fase 3.1.5) — every read of `c.raw?.separatorRows` / `c.raw?.labResults` must tolerate it being `undefined` (e.g. before the fetch resolves, or if it failed).
- Portuguese (pt-BR) for all labels and empty-state text.

---

### Task 1: `numOrDash` helper, table CSS, and the four tab views

**Files:**
- Modify: `apps/calibration/src/main.tsx`
- Modify: `apps/calibration/src/styles.css`

**Interfaces:**
- Produces: `MPFMTab({c})`, `SeparadorTab({c})`, `EvidenciasTab({c,r})` (new), and an extended `LaboratorioPvtTab` (same props as before — `{c,updateSection,save}` — just more rendered content). Consumed only by the `active` switch in this same file.

- [ ] **Step 1: Add the `numOrDash` helper, right after `pct`**

Find:

```tsx
const fmt=(n:number,d=2)=>Number.isFinite(n)?n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const pct=(n:number)=>Number.isFinite(n)?`${n<0?'−':''}${fmt(Math.abs(n)*100,2)}%`:'—';
```

Replace with:

```tsx
const fmt=(n:number,d=2)=>Number.isFinite(n)?n.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const pct=(n:number)=>Number.isFinite(n)?`${n<0?'−':''}${fmt(Math.abs(n)*100,2)}%`:'—';
const numOrDash=(n:number|null,d=2)=>n==null?'—':fmt(n,d);
```

(`numOrDash` exists because `SeparatorRow`/`LabResult`'s numeric fields are `number|null` — wrapping a `null` in `Number(...)` would silently produce `0`, not `NaN`, so `fmt` alone can't tell "absent" from "zero." `Row`'s own numeric fields, by contrast, are never `null` except the three optional `*Corr?` ones, which the existing code already guards with `!=null` checks — this new helper is only for the Grupo B tables.)

- [ ] **Step 2: Add the table/table-wrap CSS**

Append to the end of `apps/calibration/src/styles.css`:

```css
.table-wrap{overflow-x:auto;padding:0 16px 16px}table{width:100%;border-collapse:collapse;font-size:11px;white-space:nowrap}th{text-align:left;padding:8px 10px;color:#75849a;font-weight:700;border-bottom:2px solid var(--line);position:sticky;top:0;background:#fff}td{padding:7px 10px;border-bottom:1px solid #edf0f5}tbody tr:hover{background:#f8fafc}
```

- [ ] **Step 3: Add `MPFMTab`, `SeparadorTab`, `EvidenciasTab`, right before `function Drawer`**

Find:

```tsx
function Drawer({c,update,close,save}:{c:Campaign,update:(k:keyof Campaign,v:any)=>void,close:()=>void,save:()=>void}){
```

Insert immediately before that line:

```tsx
function MPFMTab({c}:{c:Campaign}){
 return <div className="page"><div className="title-row"><div><h1>MPFM</h1><p>Leituras importadas do MPFM, condição As-Found e Pós-K.</p></div></div><Panel title="Leituras MPFM" subtitle={`${c.rows.length} registros`}>{c.rows.length?<div className="table-wrap"><table><thead><tr><th>Condição</th><th>Timestamp</th><th>Usar?</th><th>Duração (h)</th><th>P (barg)</th><th>T (°C)</th><th>dP (kPa)</th><th>GVF (%)</th><th>WLR (%)</th><th>Óleo (t)</th><th>Gás (t)</th><th>Água (t)</th><th>Óleo corr (t)</th><th>Gás corr (t)</th><th>Água corr (t)</th></tr></thead><tbody>{c.rows.map((row,i)=><tr key={i}><td>{row.condition}</td><td>{row.timestamp}</td><td>{row.use?'Sim':'Não'}</td><td>{fmt(row.duration,1)}</td><td>{fmt(row.p,2)}</td><td>{fmt(row.t,2)}</td><td>{fmt(row.dp,2)}</td><td>{fmt(row.gvf,2)}</td><td>{fmt(row.wlr,2)}</td><td>{fmt(row.oil,3)}</td><td>{fmt(row.gas,3)}</td><td>{fmt(row.water,3)}</td><td>{row.oilCorr!=null?fmt(row.oilCorr,3):'—'}</td><td>{row.gasCorr!=null?fmt(row.gasCorr,3):'—'}</td><td>{row.waterCorr!=null?fmt(row.waterCorr,3):'—'}</td></tr>)}</tbody></table></div>:<div className="empty">Nenhuma leitura importada ainda.</div>}</Panel></div>
}
function SeparadorTab({c}:{c:Campaign}){
 const rows=c.raw?.separatorRows??[];
 return <div className="page"><div className="title-row"><div><h1>Separador</h1><p>Leituras do separador de teste, condição As-Found e Pós-K.</p></div></div><Panel title="Leituras do separador" subtitle={`${rows.length} registros`}>{rows.length?<div className="table-wrap"><table><thead><tr><th>Condição</th><th>Timestamp</th><th>Usar?</th><th>Duração (h)</th><th>Qualidade</th><th>P (barg)</th><th>T (°C)</th><th>Óleo GV linha (m³)</th><th>Óleo ρ Coriolis (kg/m³)</th><th>Óleo massa direta (t)</th><th>Gás (t)</th><th>Água (t)</th><th>Gás padrão (ksm³)</th><th>Água (m³)</th><th>Referência</th></tr></thead><tbody>{rows.map((row,i)=><tr key={i}><td>{row.condition}</td><td>{row.timestamp}</td><td>{row.use_flag?'Sim':'Não'}</td><td>{numOrDash(row.duration_h,1)}</td><td>{row.quality||'—'}</td><td>{numOrDash(row.pressure_barg,2)}</td><td>{numOrDash(row.temperature_c,2)}</td><td>{numOrDash(row.oil_gv_line_m3,3)}</td><td>{numOrDash(row.oil_rho_coriolis_kgm3,2)}</td><td>{numOrDash(row.oil_mass_direct_t,3)}</td><td>{numOrDash(row.gas_mass_t,3)}</td><td>{numOrDash(row.water_mass_t,3)}</td><td>{numOrDash(row.gas_std_ksm3,3)}</td><td>{numOrDash(row.water_vol_m3,3)}</td><td>{row.source_ref||'—'}</td></tr>)}</tbody></table></div>:<div className="empty">Nenhuma leitura de separador carregada ainda.</div>}</Panel></div>
}
function EvidenciasTab({c,r}:{c:Campaign,r:ReturnType<typeof calculate>}){
 const g10=r.gates.find(g=>g[0]==='G10');
 return <div className="page"><div className="title-row"><div><h1>Evidências</h1><p>Checklist de evidências e aprovações.</p></div></div><div className="status-band"><div className={c.evidence?'ok':'bad'}><CheckCircle2/><span>Evidências completas:<b>{c.evidence?'SIM':'NÃO'}</b><small>Editável na aba Campanha.</small></span></div><div className={c.approvals?'ok':'bad'}><ShieldAlert/><span>Aprovações formalizadas:<b>{c.approvals?'SIM':'NÃO'}</b><small>Editável na aba Campanha.</small></span></div></div><div className="kpis"><Kpi label="Gate G10 — Certificados e evidências críticas" value={g10&&g10[2]?'Atende':'Pendente'} limit="Ver matriz de gates completa em Visão geral" ok={!!(g10&&g10[2])}/></div><div className="form"><div className="validation"><CheckCircle2/><span><b>Evidência de aplicação do K</b><small>{c.k.evidence||'Nenhuma evidência registrada.'} — editável na aba Fatores K.</small></span></div></div></div>
}
```

- [ ] **Step 4: Extend `LaboratorioPvtTab` with the lab-results table**

Find:

```tsx
function LaboratorioPvtTab({c,updateSection,save}:{c:Campaign,updateSection:(section:'pvt'|'uncertainty'|'k',key:string,value:any)=>void,save:()=>void}){
 const num=(label:string,key:keyof Campaign['pvt'])=><label><span>{label}</span><div><input type="number" value={String(c.pvt[key]??'')} onChange={e=>updateSection('pvt',key,e.target.value===''?null:Number(e.target.value))}/></div></label>;
 const txt=(label:string,key:keyof Campaign['pvt'])=><label><span>{label}</span><div><input type="text" value={String(c.pvt[key]??'')} onChange={e=>updateSection('pvt',key,e.target.value)}/></div></label>;
 return <div className="page"><div className="title-row"><div><h1>Laboratório/PVT</h1><p>Rastreabilidade PVT e massas de referência por condição.</p></div></div><div className="form">{txt('Arquivo PVT','file')}{txt('Hash (SHA-256)','hash')}{txt('Software','software')}{txt('Versão','version')}{txt('Aprovador','approver')}{num('Óleo As-Found','asOil')}{num('Gás As-Found','asGas')}{num('Água As-Found','asWater')}{num('Óleo Pós-K','postOil')}{num('Gás Pós-K','postGas')}{num('Água Pós-K','postWater')}</div><button className="primary" onClick={save}><Save size={16}/>Salvar</button></div>
}
```

Replace with:

```tsx
function LaboratorioPvtTab({c,updateSection,save}:{c:Campaign,updateSection:(section:'pvt'|'uncertainty'|'k',key:string,value:any)=>void,save:()=>void}){
 const num=(label:string,key:keyof Campaign['pvt'])=><label><span>{label}</span><div><input type="number" value={String(c.pvt[key]??'')} onChange={e=>updateSection('pvt',key,e.target.value===''?null:Number(e.target.value))}/></div></label>;
 const txt=(label:string,key:keyof Campaign['pvt'])=><label><span>{label}</span><div><input type="text" value={String(c.pvt[key]??'')} onChange={e=>updateSection('pvt',key,e.target.value)}/></div></label>;
 const lab=c.raw?.labResults??[];
 return <div className="page"><div className="title-row"><div><h1>Laboratório/PVT</h1><p>Rastreabilidade PVT e massas de referência por condição.</p></div></div><div className="form">{txt('Arquivo PVT','file')}{txt('Hash (SHA-256)','hash')}{txt('Software','software')}{txt('Versão','version')}{txt('Aprovador','approver')}{num('Óleo As-Found','asOil')}{num('Gás As-Found','asGas')}{num('Água As-Found','asWater')}{num('Óleo Pós-K','postOil')}{num('Gás Pós-K','postGas')}{num('Água Pós-K','postWater')}</div><button className="primary" onClick={save}><Save size={16}/>Salvar</button><Panel title="Resultados de laboratório" subtitle={`${lab.length} amostras — só leitura`}>{lab.length?<div className="table-wrap"><table><thead><tr><th>Amostra</th><th>Usar?</th><th>Coletado em</th><th>Tipo</th><th>BSW (%)</th><th>ρ óleo padrão (kg/m³)</th><th>ρ gás padrão (kg/sm³)</th><th>ρ água padrão (kg/m³)</th><th>Fe</th><th>Rs</th><th>Método</th><th>Relatório</th><th>Status</th></tr></thead><tbody>{lab.map((row,i)=><tr key={i}><td>{row.sample_id||'—'}</td><td>{row.use_flag?'Sim':'Não'}</td><td>{row.sampled_at||'—'}</td><td>{row.sample_type||'—'}</td><td>{numOrDash(row.bsw_pct,2)}</td><td>{numOrDash(row.rho_oil_std_kgm3,2)}</td><td>{numOrDash(row.rho_gas_std_kgsm3,4)}</td><td>{numOrDash(row.rho_water_std_kgm3,2)}</td><td>{numOrDash(row.fe,4)}</td><td>{numOrDash(row.rs,2)}</td><td>{row.method||'—'}</td><td>{row.report_id||'—'}</td><td>{row.status||'—'}</td></tr>)}</tbody></table></div>:<div className="empty">Nenhum resultado de laboratório carregado ainda.</div>}</Panel></div>
}
```

- [ ] **Step 5: Wire `MPFM`, `Separador`, `Evidências` into the `active` switch**

Find:

```tsx
{active==='Visão geral'?<Overview c={c} r={r} setDrawer={setDrawer}/>:active==='Campanha'?<CampanhaTab c={c} update={update} updateEnvelope={updateEnvelope} save={save}/>:active==='Fatores K'?<FatoresKTab c={c} updateSection={updateSection} r={r} save={save}/>:active==='Pós-K'?<PosKTab c={c} updateSection={updateSection} r={r} save={save}/>:active==='Laboratório/PVT'?<LaboratorioPvtTab c={c} updateSection={updateSection} save={save}/>:<EmConstrucao tab={active}/>}
```

Replace with:

```tsx
{active==='Visão geral'?<Overview c={c} r={r} setDrawer={setDrawer}/>:active==='Campanha'?<CampanhaTab c={c} update={update} updateEnvelope={updateEnvelope} save={save}/>:active==='Fatores K'?<FatoresKTab c={c} updateSection={updateSection} r={r} save={save}/>:active==='Pós-K'?<PosKTab c={c} updateSection={updateSection} r={r} save={save}/>:active==='Laboratório/PVT'?<LaboratorioPvtTab c={c} updateSection={updateSection} save={save}/>:active==='MPFM'?<MPFMTab c={c}/>:active==='Separador'?<SeparadorTab c={c}/>:active==='Evidências'?<EvidenciasTab c={c} r={r}/>:<EmConstrucao tab={active}/>}
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
git commit -m "feat: implement MPFM, Separador, Evidencias tabs and lab results table"
```
