# Fase 3.3 — Grupo C: Importação e Relatórios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the last two "em construção" tabs (Importação, Relatórios) real content — a description of what the action does plus the same trigger already in the header.

**Architecture:** Two small components, each calling the existing `fileRef`/`exportExcel` — no new state, no new logic. This is the last piece of Fase 3: after this task, all 9 non-"Visão geral" tabs render real content.

**Tech Stack:** React 19, TSX — no new dependencies.

## Global Constraints

- Zero new logic — both tabs call the exact same `fileRef.current?.click()` / `exportExcel` the header buttons already use.
- Don't remove the header's "Importar"/"Exportar Excel" buttons — they stay as quick actions from any tab.
- Portuguese (pt-BR) for all text.

---

### Task 1: `ImportacaoTab` and `RelatoriosTab`, wired into the switch

**Files:**
- Modify: `apps/calibration/src/main.tsx`

**Interfaces:**
- Produces: `ImportacaoTab({fileRef})`, `RelatoriosTab({exportExcel})`. Consumed only by the `active` switch in this same file.

- [ ] **Step 1: Add the two new components, right before `function Drawer`**

Find:

```tsx
function Drawer({c,update,close,save}:{c:Campaign,update:(k:keyof Campaign,v:any)=>void,close:()=>void,save:()=>void}){
```

Insert immediately before that line:

```tsx
function ImportacaoTab({fileRef}:{fileRef:React.RefObject<HTMLInputElement>}){
 return <div className="page"><div className="title-row"><div><h1>Importação</h1><p>Carrega uma nova campanha a partir do Excel de calibração.</p></div></div><div className="form"><div className="validation"><CheckCircle2/><span><b>Formato aceito</b><small>Excel (.xlsx/.xls) com as abas "01_CAMPANHA" e "IN_01_MPFM" — mesmo modelo do botão "Importar" no topo da tela.</small></span></div><button className="primary" onClick={()=>fileRef.current?.click()}><Upload size={16}/>Selecionar arquivo</button></div></div>
}
function RelatoriosTab({exportExcel}:{exportExcel:()=>void}){
 return <div className="page"><div className="title-row"><div><h1>Relatórios</h1><p>Exporta a campanha completa em Excel.</p></div></div><div className="form"><div className="validation"><CheckCircle2/><span><b>Conteúdo do arquivo gerado</b><small>Abas "01_CAMPANHA", "IN_01_MPFM", "03_VALIDACAO" (matriz de gates) e "06_EXPORTACAO" (resultado técnico).</small></span></div><button className="primary" onClick={exportExcel}><FileSpreadsheet size={16}/>Exportar Excel</button></div></div>
}
```

- [ ] **Step 2: Wire `Importação` and `Relatórios` into the `active` switch**

Find:

```tsx
active==='Evidências'?<EvidenciasTab c={c} r={r}/>:<EmConstrucao tab={active}/>
```

Replace with:

```tsx
active==='Evidências'?<EvidenciasTab c={c} r={r}/>:active==='Importação'?<ImportacaoTab fileRef={fileRef}/>:active==='Relatórios'?<RelatoriosTab exportExcel={exportExcel}/>:<EmConstrucao tab={active}/>
```

(After this change, `EmConstrucao` has no reachable case left through the switch for any of the 9 named tabs — it stays in the file only as the switch's defensive fallback branch, which is correct: don't remove it.)

- [ ] **Step 3: Run the calibration app's own test suite**

Run: `cd apps/calibration && npm test`
Expected: `1 passed` — unchanged.

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
git commit -m "feat: implement Importacao and Relatorios tabs"
```
