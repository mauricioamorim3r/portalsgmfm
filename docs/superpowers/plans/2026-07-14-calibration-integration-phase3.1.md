# Fase 3.1 — Grupo A: Campanha, Fatores K, Pós-K, Laboratório/PVT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 4 of the calibration app's "em construção" tabs (Campanha, Fatores K, Pós-K, Laboratório/PVT) with real editable forms over data the Fase 2 write API already persists.

**Architecture:** Two new state-update helpers (`updateSection` for nested `pvt`/`uncertainty`/`k` objects, `updateEnvelope` for the `[min,max]` envelope tuples) alongside the existing `update`. Four new tab components, each a form bound to `c`/the updaters, with its own "Salvar" button calling the existing `save()`. The `active` switch in `App()`'s return grows from 2 branches (Visão geral / everything else) to 6 (Visão geral, 4 named tabs, remaining `EmConstrucao` fallback).

**Tech Stack:** React 19, TSX — no new dependencies.

## Global Constraints

- Zero change to `calculate()`, the API, or the schema — UI/forms only, over fields the `Campaign` type and Fase 2's `PUT /api/calibration` already cover.
- No auto-save on keystroke — only the tab's own "Salvar" button persists (same UX as the existing drawer).
- Portuguese (pt-BR) for all labels.
- Reuse the existing `.form`/`label`/`.validation` CSS (from `styles.css`, today only used by `Drawer`) — don't duplicate styling.

---

### Task 1: Nested-update helpers, four tab components, wire the switch

**Files:**
- Modify: `apps/calibration/src/main.tsx`
- Modify: `apps/calibration/src/styles.css`

**Interfaces:**
- Produces: `updateSection(section:'pvt'|'uncertainty'|'k', key:string, value:any):void` and `updateEnvelope(axis:'p'|'t'|'dp'|'gvf'|'wlr', index:0|1, value:number|null):void`, both local to `App()`. `CampanhaTab`, `FatoresKTab`, `PosKTab`, `LaboratorioPvtTab` components, consumed only by the switch in this same file (no other file depends on them — Grupo B's later plan will add sibling components the same way).

- [ ] **Step 1: Add the two nested-update helpers**

In `apps/calibration/src/main.tsx`, find:

```tsx
const update=(key:keyof Campaign,value:any)=>setC(x=>({...x,[key]:value})); const flash=(s:string)=>{setToast(s);setTimeout(()=>setToast(''),2600)};
```

Replace with:

```tsx
const update=(key:keyof Campaign,value:any)=>setC(x=>({...x,[key]:value})); const flash=(s:string)=>{setToast(s);setTimeout(()=>setToast(''),2600)};
const updateSection=(section:'pvt'|'uncertainty'|'k',key:string,value:any)=>setC(x=>({...x,[section]:{...x[section],[key]:value}}));
const updateEnvelope=(axis:'p'|'t'|'dp'|'gvf'|'wlr',index:0|1,value:number|null)=>setC(x=>{const arr:[number|null,number|null]=[...x.envelope[axis]] as any;arr[index]=value;return {...x,envelope:{...x.envelope,[axis]:arr}}});
```

- [ ] **Step 2: Add the four tab components**

In `apps/calibration/src/main.tsx`, function declaration order today is `Kpi`, `Panel`, `EmConstrucao`, `Overview`, `Drawer` (in that order — `Overview` comes right before `Drawer`, not after `Kpi`). Find the start of `Drawer`'s declaration:

```tsx
function Drawer({c,update,close,save}:{c:Campaign,update:(k:keyof Campaign,v:any)=>void,close:()=>void,save:()=>void}){
```

Insert the four new components immediately before that line (i.e., right after `Overview`'s closing `}` and before `function Drawer`):

```tsx
function CampanhaTab({c,update,updateEnvelope,save}:{c:Campaign,update:(k:keyof Campaign,v:any)=>void,updateEnvelope:(axis:'p'|'t'|'dp'|'gvf'|'wlr',index:0|1,value:number|null)=>void,save:()=>void}){
 const field=(label:string,key:keyof Campaign,type='text',unit='')=><label><span>{label}</span><div><input type={type} value={String(c[key]??'')} onChange={e=>update(key,type==='number'?Number(e.target.value):e.target.value)}/>{unit&&<em>{unit}</em>}</div></label>;
 const envField=(label:string,axis:'p'|'t'|'dp'|'gvf'|'wlr',unit:string)=><label><span>{label}</span><div className="envelope-pair"><input type="number" placeholder="mín" value={c.envelope[axis][0]??''} onChange={e=>updateEnvelope(axis,0,e.target.value===''?null:Number(e.target.value))}/><input type="number" placeholder="máx" value={c.envelope[axis][1]??''} onChange={e=>updateEnvelope(axis,1,e.target.value===''?null:Number(e.target.value))}/><em>{unit}</em></div></label>;
 return <div className="page"><div className="title-row"><div><h1>Campanha</h1><p>Dados gerais, critérios e envelope operacional.</p></div></div><div className="form">{field('Campaign ID','id')}{field('Ativo / instalação','asset')}{field('Poço / Riser','well')}{field('TAG do MPFM','tag')}{field('Número de série','serial')}{field('Referência autorizada','reference')}{field('Pressão de bolha','pb','number','barg')}{field('Limite de desvio HC','hcLimit','number','fração')}{field('Limite de desvio total','totalLimit','number','fração')}{field('Timezone','timezone')}{field('Responsável técnico','responsible')}{field('Aprovador','approver')}{envField('Envelope de pressão','p','barg')}{envField('Envelope de temperatura','t','°C')}{envField('Envelope de dP','dp','kPa')}{envField('Envelope de GVF','gvf','%')}{envField('Envelope de WLR','wlr','%')}<label><span>Evidências completas</span><input type="checkbox" checked={c.evidence} onChange={e=>update('evidence',e.target.checked)}/></label><label><span>Aprovações formalizadas</span><input type="checkbox" checked={c.approvals} onChange={e=>update('approvals',e.target.checked)}/></label></div><button className="primary" onClick={save}><Save size={16}/>Salvar</button></div>
}
function FatoresKTab({c,updateSection,r,save}:{c:Campaign,updateSection:(section:'pvt'|'uncertainty'|'k',key:string,value:any)=>void,r:ReturnType<typeof calculate>,save:()=>void}){
 const num=(label:string,key:keyof Campaign['k'])=><label><span>{label}</span><div><input type="number" value={String(c.k[key]??'')} onChange={e=>updateSection('k',key,e.target.value===''?null:Number(e.target.value))}/></div></label>;
 const txt=(label:string,key:keyof Campaign['k'])=><label><span>{label}</span><div><input type="text" value={String(c.k[key]??'')} onChange={e=>updateSection('k',key,e.target.value)}/></div></label>;
 return <div className="page"><div className="title-row"><div><h1>Fatores K</h1><p>K aprovado e aplicado por fase, comparado ao K calculado.</p></div></div><div className="kpis"><Kpi label="K óleo calculado" value={fmt(r.kOil,5)} limit="Base mássica equalizada" ok={r.kOil>=c.kMin&&r.kOil<=c.kMax}/><Kpi label="K gás calculado" value={fmt(r.kGas,5)} limit="Base mássica equalizada" ok={r.kGas>=c.kMin&&r.kGas<=c.kMax}/><Kpi label="K água calculado" value={fmt(r.kWater,5)} limit="Base mássica equalizada" ok={r.kWater>=c.kMin&&r.kWater<=c.kMax}/></div><div className="form">{num('K óleo aprovado','oilApproved')}{num('K óleo aplicado','oilApplied')}{num('K gás aprovado','gasApproved')}{num('K gás aplicado','gasApplied')}{num('K água aprovado','waterApproved')}{num('K água aplicado','waterApplied')}{txt('Data de aplicação','date')}{txt('Responsável','responsible')}{txt('Evidência','evidence')}</div><button className="primary" onClick={save}><Save size={16}/>Salvar</button></div>
}
function PosKTab({c,updateSection,r,save}:{c:Campaign,updateSection:(section:'pvt'|'uncertainty'|'k',key:string,value:any)=>void,r:ReturnType<typeof calculate>,save:()=>void}){
 const num=(label:string,key:keyof Campaign['uncertainty'])=><label><span>{label}</span><div><input type="number" value={String(c.uncertainty[key]??'')} onChange={e=>updateSection('uncertainty',key,e.target.value===''?null:Number(e.target.value))}/></div></label>;
 return <div className="page"><div className="title-row"><div><h1>Pós-K</h1><p>Incerteza pós-K e resultado da validação.</p></div></div><div className="status-band"><div className={Math.abs(r.postDevHC)<=c.hcLimit?'ok':'bad'}><CheckCircle2/><span>Resultado técnico pós-K:<b>{Math.abs(r.postDevHC)<=c.hcLimit?'ATENDE':'NÃO ATENDE'}</b><small>Desvio HC: {pct(r.postDevHC)}</small></span></div></div><div className="kpis"><Kpi label="Desvio HC Pós-K" value={pct(r.postDevHC)} limit={`Critério: ≤ ${fmt(c.hcLimit*100,0)}%`} ok={Math.abs(r.postDevHC)<=c.hcLimit}/><Kpi label="Desvio Total Pós-K" value={pct(r.postDevTotal)} limit={`Critério: ≤ ${fmt(c.totalLimit*100,0)}%`} ok={Math.abs(r.postDevTotal)<=c.totalLimit}/><Kpi label="En Pós-K" value={fmt(r.enPost,3)} limit="Critério: ≤ 1,000" ok={r.enPost<=1}/></div><div className="form">{num('Incerteza MPFM pós-K','postMpfm')}{num('Incerteza referência pós-K','postRef')}</div><button className="primary" onClick={save}><Save size={16}/>Salvar</button></div>
}
function LaboratorioPvtTab({c,updateSection,save}:{c:Campaign,updateSection:(section:'pvt'|'uncertainty'|'k',key:string,value:any)=>void,save:()=>void}){
 const num=(label:string,key:keyof Campaign['pvt'])=><label><span>{label}</span><div><input type="number" value={String(c.pvt[key]??'')} onChange={e=>updateSection('pvt',key,e.target.value===''?null:Number(e.target.value))}/></div></label>;
 const txt=(label:string,key:keyof Campaign['pvt'])=><label><span>{label}</span><div><input type="text" value={String(c.pvt[key]??'')} onChange={e=>updateSection('pvt',key,e.target.value)}/></div></label>;
 return <div className="page"><div className="title-row"><div><h1>Laboratório/PVT</h1><p>Rastreabilidade PVT e massas de referência por condição.</p></div></div><div className="form">{txt('Arquivo PVT','file')}{txt('Hash (SHA-256)','hash')}{txt('Software','software')}{txt('Versão','version')}{txt('Aprovador','approver')}{num('Óleo As-Found','asOil')}{num('Gás As-Found','asGas')}{num('Água As-Found','asWater')}{num('Óleo Pós-K','postOil')}{num('Gás Pós-K','postGas')}{num('Água Pós-K','postWater')}</div><button className="primary" onClick={save}><Save size={16}/>Salvar</button></div>
}
```

- [ ] **Step 3: Wire the four new tabs into the `active` switch**

Find (added in Fase 3.0, inside `App()`'s `return`, right after `</header>`):

```tsx
{active==='Visão geral'?<Overview c={c} r={r} setDrawer={setDrawer}/>:<EmConstrucao tab={active}/>}
```

Replace with:

```tsx
{active==='Visão geral'?<Overview c={c} r={r} setDrawer={setDrawer}/>:active==='Campanha'?<CampanhaTab c={c} update={update} updateEnvelope={updateEnvelope} save={save}/>:active==='Fatores K'?<FatoresKTab c={c} updateSection={updateSection} r={r} save={save}/>:active==='Pós-K'?<PosKTab c={c} updateSection={updateSection} r={r} save={save}/>:active==='Laboratório/PVT'?<LaboratorioPvtTab c={c} updateSection={updateSection} save={save}/>:<EmConstrucao tab={active}/>}
```

- [ ] **Step 4: Add the envelope-pair CSS**

Append to the end of `apps/calibration/src/styles.css` (same single-line-per-block convention as the rest of the file):

```css
.envelope-pair{display:flex;gap:6px;align-items:center}.envelope-pair input{border:1px solid #79bb87;border-radius:5px;padding:9px 10px;width:80px;font-size:12px;background:#f8fff9}.envelope-pair em{font-size:10px;color:#557263}
```

- [ ] **Step 5: Run the calibration app's own test suite**

Run: `cd apps/calibration && npm test`
Expected: `1 passed` — unchanged, `engine.test.ts` only exercises `calculate()`.

- [ ] **Step 6: Build**

```bash
cd apps/calibration
npm run build
cd ../..
```

Expected: exits 0.

- [ ] **Step 7: Copy the rebuilt output into `public/calibracao/`**

```bash
rm -rf public/calibracao
mkdir -p public/calibracao
cp -r apps/calibration/dist/. public/calibracao/
```

- [ ] **Step 8: Commit**

```bash
git add apps/calibration/src/main.tsx apps/calibration/src/styles.css public/calibracao
git commit -m "feat: implement Campanha, Fatores K, Pos-K and Laboratorio/PVT tabs"
```
