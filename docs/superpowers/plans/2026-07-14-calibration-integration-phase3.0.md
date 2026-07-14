# Fase 3.0 — Shell de troca de tela por aba Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the calibration app's 9 nav tabs actually switch rendered content instead of always showing the "Visão geral" dashboard regardless of which tab is selected.

**Architecture:** Extract the existing always-rendered dashboard JSX into a named `Overview` component (behavior-identical), add a minimal `EmConstrucao` placeholder component for the other 8 tabs, and switch between them based on the existing `active` state — all within the single `apps/calibration/src/main.tsx` file, matching its existing dense single-file convention.

**Tech Stack:** React 19, TSX (no new dependencies).

## Global Constraints

- Zero change to calculations, data, or the API — this is UI routing only.
- "Visão geral" must render byte-identical output to today (pure extraction, not a rewrite).
- Placeholder text for the other 8 tabs must clearly say the screen isn't built yet — never anything that could read as real data (project-wide "no fake data" rule).
- Portuguese (pt-BR) for the placeholder text.

---

### Task 1: Extract `Overview`, add `EmConstrucao`, wire the switch

**Files:**
- Modify: `apps/calibration/src/main.tsx`

**Interfaces:**
- Produces: `Overview({ c, r, setDrawer })` and `EmConstrucao({ tab })` components, both local to this file. No other file consumes them (Fase 3.1+ will replace `EmConstrucao`'s branches one tab at a time, in a later plan).

- [ ] **Step 1: Add the two new components**

In `apps/calibration/src/main.tsx`, right after the existing `Panel` function component (`function Panel({title,subtitle,children,className=''})...`), add:

```tsx
function EmConstrucao({tab}:{tab:string}){return <div className="empty"><div><b>{tab}</b><br/>Tela ainda não implementada.</div></div>}
function Overview({c,r,setDrawer}:{c:Campaign,r:ReturnType<typeof calculate>,setDrawer:(v:boolean)=>void}){return <div className="page"><div className="title-row"><div><h1>MPFM Performance & Calibration — Riser P4</h1><p>Campanha controlada, decisão metrológica e rastreabilidade end-to-end.</p></div><button className="primary" onClick={()=>setDrawer(true)}>Editar campanha</button></div><div className="steps">{['Dados e importação','Verificações iniciais','Performance As-Found','Pós-K e validação','Aprovação técnica','Emissão'].map((s,i)=><div className={i<3?'done':i===3?'current':''} key={s}><span>{i<3?<Check size={15}/>:i+1}</span><b>{s}</b></div>)}</div><div className="status-band"><div className={Math.abs(r.postDevHC)<=c.hcLimit?'ok':'bad'}><CheckCircle2/><span>Resultado técnico pós-K:<b>{Math.abs(r.postDevHC)<=c.hcLimit?'ATENDE':'NÃO ATENDE'}</b><small>Comparação independente na P/T do MPFM.</small></span></div><div className={r.issue?'ok':'bad'}><ShieldAlert/><span>Prontidão de emissão:<b>{r.issue?'APTA':'BLOQUEADA'}</b><small>{r.gates.filter(g=>!g[2]).length} pendências impedem o fechamento.</small></span></div></div><div className="kpis"><Kpi label="Desvio HC As-Found" value={pct(r.devHC)} limit={`Critério: ≤ ${fmt(c.hcLimit*100,0)}%`} ok={Math.abs(r.devHC)<=c.hcLimit}/><Kpi label="Desvio HC Pós-K" value={pct(r.postDevHC)} limit={`Critério: ≤ ${fmt(c.hcLimit*100,0)}%`} ok={Math.abs(r.postDevHC)<=c.hcLimit}/><Kpi label="En Pós-K" value={fmt(r.enPost,3)} limit="Critério: ≤ 1,000" ok={r.enPost<=1}/><Kpi label="K óleo calculado" value={fmt(r.kOil,5)} limit="Base mássica equalizada" ok={r.kOil>=c.kMin&&r.kOil<=c.kMax}/></div><div className="dashboard-grid"><Panel title="MPFM × referência equalizada — As-Found" subtitle="Comparação em massa (t)"><CompareChart r={r}/></Panel><Panel title="Estabilidade operacional — As-Found" subtitle="Pressão horária (barg)"><SparkChart rows={r.as}/></Panel><Panel title="Matriz dos 16 gates" subtitle="O pior gate obrigatório prevalece" className="gates"><div className="gate-grid">{r.gates.map(g=><button key={g[0]} className={g[2]?'pass':'pending'} title={g[1]}><span>{g[0]}</span>{g[2]?<CheckCircle2/>:<AlertTriangle/>}<small>{g[1]}</small></button>)}</div><div className="legend"><span><i className="green"/>Atende</span><span><i className="amber"/>Pendente</span></div></Panel><Panel title="Pendências prioritárias" subtitle="Ações necessárias para emissão"><div className="issues">{r.gates.filter(g=>!g[2]).slice(0,6).map((g,i)=><div key={g[0]}><b>{i<2?'Alta':'Média'}</b><span><strong>{g[0]} — {g[1]}</strong><small>{g[0]==='G04'?'Anexar arquivo PVT, hash, versão e aprovação.':g[0]==='G07'?'Cadastrar envelope numérico aprovado.':'Completar dados e evidências da etapa.'}</small></span><em>Aberta</em></div>)}</div></Panel></div></div>}
```

(This `Overview` body is the exact `<section className="page">...</section>` content that exists today in `App()`'s `return`, unchanged except the outer tag is now `<div className="page">` instead of `<section className="page">` — kept as a plain `div` since it's now a component's root rather than a direct child of `<main>`; the CSS class `.page` doesn't depend on the tag name, only the class, so this is a pure behavior-preserving rename of the wrapping element type.)

- [ ] **Step 2: Replace the fixed `<section className="page">` in `App()`'s `return` with the switch**

Find this exact block inside `App()`'s `return` (currently right after `</header>`):

```tsx
<section className="page"><div className="title-row"><div><h1>MPFM Performance & Calibration — Riser P4</h1><p>Campanha controlada, decisão metrológica e rastreabilidade end-to-end.</p></div><button className="primary" onClick={()=>setDrawer(true)}>Editar campanha</button></div><div className="steps">{['Dados e importação','Verificações iniciais','Performance As-Found','Pós-K e validação','Aprovação técnica','Emissão'].map((s,i)=><div className={i<3?'done':i===3?'current':''} key={s}><span>{i<3?<Check size={15}/>:i+1}</span><b>{s}</b></div>)}</div><div className="status-band"><div className={Math.abs(r.postDevHC)<=c.hcLimit?'ok':'bad'}><CheckCircle2/><span>Resultado técnico pós-K:<b>{Math.abs(r.postDevHC)<=c.hcLimit?'ATENDE':'NÃO ATENDE'}</b><small>Comparação independente na P/T do MPFM.</small></span></div><div className={r.issue?'ok':'bad'}><ShieldAlert/><span>Prontidão de emissão:<b>{r.issue?'APTA':'BLOQUEADA'}</b><small>{r.gates.filter(g=>!g[2]).length} pendências impedem o fechamento.</small></span></div></div><div className="kpis"><Kpi label="Desvio HC As-Found" value={pct(r.devHC)} limit={`Critério: ≤ ${fmt(c.hcLimit*100,0)}%`} ok={Math.abs(r.devHC)<=c.hcLimit}/><Kpi label="Desvio HC Pós-K" value={pct(r.postDevHC)} limit={`Critério: ≤ ${fmt(c.hcLimit*100,0)}%`} ok={Math.abs(r.postDevHC)<=c.hcLimit}/><Kpi label="En Pós-K" value={fmt(r.enPost,3)} limit="Critério: ≤ 1,000" ok={r.enPost<=1}/><Kpi label="K óleo calculado" value={fmt(r.kOil,5)} limit="Base mássica equalizada" ok={r.kOil>=c.kMin&&r.kOil<=c.kMax}/></div><div className="dashboard-grid"><Panel title="MPFM × referência equalizada — As-Found" subtitle="Comparação em massa (t)"><CompareChart r={r}/></Panel><Panel title="Estabilidade operacional — As-Found" subtitle="Pressão horária (barg)"><SparkChart rows={r.as}/></Panel><Panel title="Matriz dos 16 gates" subtitle="O pior gate obrigatório prevalece" className="gates"><div className="gate-grid">{r.gates.map(g=><button key={g[0]} className={g[2]?'pass':'pending'} title={g[1]}><span>{g[0]}</span>{g[2]?<CheckCircle2/>:<AlertTriangle/>}<small>{g[1]}</small></button>)}</div><div className="legend"><span><i className="green"/>Atende</span><span><i className="amber"/>Pendente</span></div></Panel><Panel title="Pendências prioritárias" subtitle="Ações necessárias para emissão"><div className="issues">{r.gates.filter(g=>!g[2]).slice(0,6).map((g,i)=><div key={g[0]}><b>{i<2?'Alta':'Média'}</b><span><strong>{g[0]} — {g[1]}</strong><small>{g[0]==='G04'?'Anexar arquivo PVT, hash, versão e aprovação.':g[0]==='G07'?'Cadastrar envelope numérico aprovado.':'Completar dados e evidências da etapa.'}</small></span><em>Aberta</em></div>)}</div></Panel></div></section>
```

Replace with:

```tsx
{active==='Visão geral'?<Overview c={c} r={r} setDrawer={setDrawer}/>:<EmConstrucao tab={active}/>}
```

- [ ] **Step 3: Run the calibration app's own test suite**

Run: `cd apps/calibration && npm test`
Expected: `1 passed` — unchanged, `engine.test.ts` only exercises `calculate()`, not rendering.

- [ ] **Step 4: Build**

```bash
cd apps/calibration
npm run build
cd ../..
```

Expected: exits 0.

- [ ] **Step 5: Copy the rebuilt output into `public/calibracao/`**

```bash
rm -rf public/calibracao
mkdir -p public/calibracao
cp -r apps/calibration/dist/. public/calibracao/
```

- [ ] **Step 6: Commit**

```bash
git add apps/calibration/src/main.tsx public/calibracao
git commit -m "feat: switch calibration app content per selected tab"
```
