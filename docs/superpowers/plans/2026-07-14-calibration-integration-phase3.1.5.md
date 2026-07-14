# Fase 3.1.5 — Carregar a campanha real da API no carregamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the calibration app fetch the real campaign from `GET /api/calibration?campaignId=` on load instead of only ever showing `localStorage` or the hardcoded `initial` sample — so every tab (including Fase 3.2's Grupo B) shows genuine database data.

**Architecture:** One `useEffect` in `App()` that fetches once on mount and replaces state if the request succeeds; existing `localStorage`/`initial` fallback stays untouched as the behavior when the fetch fails. Two new types (`SeparatorRow`, `LabResult`) and an optional `raw` field on `Campaign` give the fetched `campaign.raw.*` arrays a typed home for Fase 3.2 to consume later.

**Tech Stack:** React 19 `useEffect`, same-origin `fetch` (already the pattern `save()` uses since Fase 2).

## Global Constraints

- Zero change to `calculate()` or any existing calculation.
- If the fetch fails (network error, non-200, `status!=="ok"`), the app must behave exactly as it does today (no error thrown, no broken UI) — silent fallback to whatever `localStorage`/`initial` already provided.
- `Campaign.raw` is optional (`raw?`) — nothing existing may assume it's always present.

---

### Task 1: Add `raw`-carrying types and the load-on-mount effect

**Files:**
- Modify: `apps/calibration/src/main.tsx`

**Interfaces:**
- Produces: `Campaign.raw?: { separatorRows: SeparatorRow[], labResults: LabResult[] }`, populated after a successful fetch. Fase 3.2's Grupo B plan will read `c.raw?.separatorRows` / `c.raw?.labResults` directly.

- [ ] **Step 1: Add `useEffect` to the React import**

Find:

```tsx
import React, {useMemo,useRef,useState} from 'react';
```

Replace with:

```tsx
import React, {useEffect,useMemo,useRef,useState} from 'react';
```

- [ ] **Step 2: Add the two new row types, right after the `Row` type declaration**

Find:

```tsx
type Row={condition:'AS_FOUND'|'POST_K';timestamp:string;use:boolean;duration:number;p:number;t:number;dp:number;gvf:number;wlr:number;oil:number;gas:number;water:number;oilCorr?:number;gasCorr?:number;waterCorr?:number};
```

Replace with:

```tsx
type Row={condition:'AS_FOUND'|'POST_K';timestamp:string;use:boolean;duration:number;p:number;t:number;dp:number;gvf:number;wlr:number;oil:number;gas:number;water:number;oilCorr?:number;gasCorr?:number;waterCorr?:number};
type SeparatorRow={condition:string,timestamp:string,use_flag:number,duration_h:number|null,quality:string,pressure_barg:number|null,temperature_c:number|null,oil_gv_line_m3:number|null,oil_rho_coriolis_kgm3:number|null,oil_mass_direct_t:number|null,gas_mass_t:number|null,water_mass_t:number|null,gas_std_ksm3:number|null,water_vol_m3:number|null,source_ref:string};
type LabResult={sample_id:string,use_flag:number,sampled_at:string,sample_type:string,bsw_pct:number|null,rho_oil_std_kgm3:number|null,rho_gas_std_kgsm3:number|null,rho_water_std_kgm3:number|null,fe:number|null,rs:number|null,method:string,report_id:string,status:string};
```

(`use_flag` is `number` — 0/1 — because `campaign.raw.*` passes straight through from D1 without the `Boolean(row.use_flag)` conversion that `campaign.rows` already gets in `db/calibration.ts`.)

- [ ] **Step 3: Add the `raw?` field to `Campaign`**

Find (note: `Campaign` already has an unrelated `integrity.raw:boolean` field, nested inside `integrity` — this step adds a *different*, top-level `raw` field, a sibling of `rows`, not a rename of that one):

```tsx
type Campaign={id:string,revision:string,nature:string,asset:string,well:string,tag:string,serial:string,type:string,reference:string,start:string,end:string,postStart:string,postEnd:string,pb:number,hcLimit:number,totalLimit:number,pvtLimit:number,kMin:number,kMax:number,minRecords:number,pvtMonths:number,timezone:string,responsible:string,approver:string,envelope:{p:[number|null,number|null],t:[number|null,number|null],dp:[number|null,number|null],gvf:[number|null,number|null],wlr:[number|null,number|null]},pvt:{asOil:number,asGas:number,asWater:number,postOil:number,postGas:number,postWater:number,file:string,hash:string,software:string,version:string,approver:string},uncertainty:{asMpfm:number,asRef:number,postMpfm:number,postRef:number},k:{oilApproved:number,gasApproved:number,waterApproved:number,oilApplied:number,gasApplied:number,waterApplied:number,date:string,responsible:string,evidence:string},integrity:{raw:boolean,dp:boolean,units:boolean,timezone:boolean,gaps:boolean,exclusions:boolean},evidence:boolean,approvals:boolean,rows:Row[]};
```

Replace with:

```tsx
type Campaign={id:string,revision:string,nature:string,asset:string,well:string,tag:string,serial:string,type:string,reference:string,start:string,end:string,postStart:string,postEnd:string,pb:number,hcLimit:number,totalLimit:number,pvtLimit:number,kMin:number,kMax:number,minRecords:number,pvtMonths:number,timezone:string,responsible:string,approver:string,envelope:{p:[number|null,number|null],t:[number|null,number|null],dp:[number|null,number|null],gvf:[number|null,number|null],wlr:[number|null,number|null]},pvt:{asOil:number,asGas:number,asWater:number,postOil:number,postGas:number,postWater:number,file:string,hash:string,software:string,version:string,approver:string},uncertainty:{asMpfm:number,asRef:number,postMpfm:number,postRef:number},k:{oilApproved:number,gasApproved:number,waterApproved:number,oilApplied:number,gasApplied:number,waterApplied:number,date:string,responsible:string,evidence:string},integrity:{raw:boolean,dp:boolean,units:boolean,timezone:boolean,gaps:boolean,exclusions:boolean},evidence:boolean,approvals:boolean,rows:Row[],raw?:{separatorRows:SeparatorRow[],labResults:LabResult[]}};
```

- [ ] **Step 4: Add the fetch-on-mount effect**

Find (the first line inside `App()`):

```tsx
 const [c,setC]=useState<Campaign>(()=>{try{return JSON.parse(localStorage.getItem('mpfm-campaign')||'null')||initial}catch{return initial}}),[active,setActive]=useState('Visão geral'),[drawer,setDrawer]=useState(false),[toast,setToast]=useState(''),[mobile,setMobile]=useState(false); const fileRef=useRef<HTMLInputElement>(null); const r=useMemo(()=>calculate(c),[c]);
```

Replace with:

```tsx
 const [c,setC]=useState<Campaign>(()=>{try{return JSON.parse(localStorage.getItem('mpfm-campaign')||'null')||initial}catch{return initial}}),[active,setActive]=useState('Visão geral'),[drawer,setDrawer]=useState(false),[toast,setToast]=useState(''),[mobile,setMobile]=useState(false); const fileRef=useRef<HTMLInputElement>(null); const r=useMemo(()=>calculate(c),[c]);
 useEffect(()=>{let alive=true;fetch(`/api/calibration?campaignId=${encodeURIComponent(c.id)}`).then(res=>res.json()).then(data=>{if(alive&&data.status==='ok'&&data.campaign)setC(data.campaign)}).catch(()=>{});return ()=>{alive=false}},[]);
```

(The effect's own mount-guard flag is named `alive`, not `active`, to avoid shadowing the existing `active`/`setActive` tab-selection state declared a few tokens earlier on the same original line.)

- [ ] **Step 5: Run the calibration app's own test suite**

Run: `cd apps/calibration && npm test`
Expected: `1 passed` — unchanged.

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
git add apps/calibration/src/main.tsx public/calibracao
git commit -m "feat: fetch the real campaign from the API on app load"
```
