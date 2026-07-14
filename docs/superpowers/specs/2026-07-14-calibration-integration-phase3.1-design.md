# Fase 3.1 — Grupo A: Campanha, Fatores K, Pós-K, Laboratório/PVT (parte PVT)

## Contexto

Fase 3.0 fez o shell trocar de tela por aba (`active==='Visão geral'?<Overview/>:<EmConstrucao tab={active}/>`).
Esta fase substitui 4 dessas 8 abas "em construção" por telas reais e
editáveis, sobre dados que a API da Fase 2 (`PUT /api/calibration`) já
persiste: **Campanha**, **Fatores K**, **Pós-K**, **Laboratório/PVT** (só a
parte PVT — lab results fica pro Grupo B, que ainda não tem API de escrita).

## Objetivo

- 4 componentes de tela novos em `apps/calibration/src/main.tsx`, cada um
  com formulário + botão "Salvar" próprio (chama o `save()` que já existe —
  grava local E na API).
- Nenhuma tecla dispara save sozinha — só o botão, mesmo padrão do drawer
  atual.
- Campos cobrem exatamente o que `Campaign` já carrega (nada novo no tipo,
  nada novo na API — Fase 2 já persiste tudo isso).

## Problema de infraestrutura: updates aninhados

Hoje só existe `update(key:keyof Campaign,value)` — só troca campo de
primeiro nível (`setC(x=>({...x,[key]:value}))`). Os campos dessas 4 abas
vivem em objetos aninhados (`envelope.p[0]`, `pvt.asOil`, `k.oilApproved`,
`uncertainty.asMpfm`) e o `envelope` guarda tuplas `[min,max]`, não campos
soltos. Duas funções novas em `App()`, ao lado de `update`:

```tsx
const updateSection=(section:'pvt'|'uncertainty'|'k',key:string,value:any)=>setC(x=>({...x,[section]:{...x[section],[key]:value}}));
const updateEnvelope=(axis:'p'|'t'|'dp'|'gvf'|'wlr',index:0|1,value:number|null)=>setC(x=>{const arr:[number|null,number|null]=[...x.envelope[axis]] as any;arr[index]=value;return {...x,envelope:{...x.envelope,[axis]:arr}}});
```

## As 4 telas

Cada uma reaproveita a classe `.form`/`label`/`.validation` que já existe em
`styles.css` (hoje só usada pelo `Drawer`) — sem CSS novo. Padrão de campo
igual ao `field(...)` do `Drawer`, adaptado pra usar `updateSection`/
`updateEnvelope` em vez de `update`.

### Campanha

Campos escalares que o drawer já edita (id, ativo, poço, TAG, série,
referência, Pb, limites, timezone, responsável, aprovador) **mais** o que o
drawer não cobre: envelope operacional (P/T/dP/GVF/WLR, min e max de cada) e
os dois booleanos `evidence`/`approvals` (checkboxes). Não duplica o
drawer — é a superfície de edição completa; o drawer continua existindo
como atalho rápido pros 12 campos básicos, sem conflito (mesmo `c`/
`update`/`save`).

### Fatores K

Por fase (Óleo/Gás/Água): `k.oilApproved/gasApproved/waterApproved`,
`k.oilApplied/gasApplied/waterApplied` — 6 campos numéricos. Mais
`k.date`/`k.responsible`/`k.evidence` (só se aplicam à fase Óleo no banco,
mas no `Campaign` do frontend são campos únicos — ver nota da Fase 2: só a
linha ÓLEO recebe esses 3 no banco). Mostra ao lado o K **calculado**
(`r.kOil`/`r.kGas`/`r.kWater`, já vem de `calculate()`) pra comparação
visual entre calculado vs aprovado vs aplicado — só leitura, não edita
`r.*` (isso é sempre derivado).

### Pós-K

`uncertainty.postMpfm`/`postRef` editáveis. Mostra resultado calculado
(`r.postDevHC`, `r.postDevTotal`, `r.enPost`) — só leitura, mesmo padrão do
KPI "En Pós-K" que já existe em `Overview`.

### Laboratório/PVT (parte PVT)

`pvt.file`, `pvt.hash`, `pvt.software`, `pvt.version`, `pvt.approver`
(texto) e `pvt.asOil/asGas/asWater/postOil/postGas/postWater` (número).
Lab results (`campaign.raw.labResults`) fica de fora — sem API de escrita
ainda (Grupo B).

## Fora de escopo

- MPFM, Separador, Evidências, Importação, Relatórios — outras fases.
- Lab results dentro de Laboratório/PVT — Grupo B.
- Qualquer mudança em `calculate()`, na API, ou no schema.

## Testes

- `apps/calibration`'s `npm test` continua passando (não testa UI).
- Verificação manual (Playwright): abrir cada uma das 4 abas, editar um
  campo, clicar Salvar, conferir toast de sucesso e (via `GET
  /api/calibration`) que persistiu.
