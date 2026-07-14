# Fase 2 — API de escrita para o módulo de calibração

## Contexto

Continuação do projeto de integração do módulo de calibração (ver
[Fase 1](2026-07-14-calibration-integration-phase1-design.md)). Hoje
`GET /api/calibration` (`app/api/calibration/route.ts` +
`db/calibration.ts` → `loadCalibrationCampaign`) só lê: monta uma campanha a
partir das tabelas `calibration_*` no shape exato que o motor do Metrolog
(`apps/calibration/src/main.tsx`, tipo `Campaign`) espera. O app em si só
persiste edições no `localStorage` do navegador — nada volta pro D1.

Esta fase adiciona escrita: um `PUT` que recebe a campanha inteira (mesmo
shape do `GET`) e grava no D1, e liga o botão "Salvar" existente do Metrolog
pra chamar essa API além do `localStorage`.

## Objetivo da Fase 2

- `PUT /api/calibration?campaignId=<id>` grava a campanha inteira no D1.
- Botão "Salvar" do drawer (`apps/calibration/src/main.tsx`, função `save`)
  chama a API E mantém o `localStorage` (fallback offline / cache).
- Nenhuma tela nova, nenhum campo novo na UI — as 9 abas decorativas continuam
  decorativas (Fase 3). Só o que já é editável hoje (os 12 campos do drawer)
  passa a persistir de verdade; a API em si aceita o shape completo (envelope,
  PVT, K, incerteza, evidence/approvals) mesmo sem UI pra maioria disso ainda,
  pra Fase 3 não precisar tocar backend de novo.

## Escopo dos dados gravados

Corpo do `PUT` = exatamente o shape que `GET` já retorna em `campaign`, **sem**
`rows` e sem `raw`:

```
{ id, revision, nature, asset, well, tag, serial, reference, start, end,
  postStart, postEnd, pb, hcLimit, totalLimit, pvtLimit, kMin, kMax,
  minRecords, pvtMonths, timezone, responsible, approver,
  envelope: { p, t, dp, gvf, wlr },   // cada um [min, max]
  pvt: { asOil, asGas, asWater, postOil, postGas, postWater, file, hash, software, version, approver },
  uncertainty: { asMpfm, asRef, postMpfm, postRef },
  k: { oilApproved, gasApproved, waterApproved, oilApplied, gasApplied, waterApplied, date, responsible, evidence },
  evidence, approvals }
```

`rows` (linhas MPFM/separador) e tudo que hoje só aparece em `campaign.raw`
(separador, lab, `eos_model`, `input_*`, `system`, `notes`, `status` etc.)
**não fazem parte do corpo** e não são tocados por este endpoint — continuam
só-leitura/só-importação (`scripts/import-mpfm-calibration.py`), preservados
exatamente como estão hoje no banco.

## Comportamento do endpoint

`PUT /api/calibration?campaignId=<campaign_id texto>`

1. Falta `campaignId` na URL → `400`.
2. Campanha não existe (`SELECT id FROM calibration_campaigns WHERE
   campaign_id = ?` não acha nada) → `404`. Este endpoint **não cria**
   campanha nova — criação continua sendo só via
   `scripts/import-mpfm-calibration.py`.
3. Corpo validado manualmente (sem Zod — o repo não usa Zod em código próprio
   hoje, só chega via dependência transitiva do `drizzle-kit`; seguir o
   padrão manual já usado no handler `GET` em vez de introduzir uma lib nova
   pra um caso de uso): campos texto são string (aceita vazio), campos
   numéricos são `number` ou `null`, `envelope.*` são tuplas `[number|null,
   number|null]`, `evidence`/`approvals` são `boolean`.
4. Grava via `env.DB.batch([...])` (atômico — tudo ou nada):
   - `UPDATE calibration_campaigns SET campaign_id=?, revision=?, ...
     WHERE id = <id numérico interno>` — inclui `campaign_id=?`, então
     **renomear o Campaign ID é suportado** (o drawer já deixa editar esse
     campo); o índice único do D1 rejeita colisão com outra campanha
     existente (vira erro 500 genérico, mesmo tratamento de erro que já
     existe no handler).
   - `INSERT INTO calibration_pvt_records (...) VALUES (...) ON CONFLICT
     (campaign_id, condition) DO UPDATE SET file=excluded.file, ...` — uma
     vez pra `AS_FOUND` (usando `pvt.asOil/asGas/asWater`), uma vez pra
     `POST_K` (usando `pvt.postOil/postGas/postWater`). Campos que o
     `Campaign` do Metrolog não carrega (`eos_model`, `input_*`, `pb_barg`,
     `loaded_at`, `responded_at`) **não entram no `DO UPDATE SET`** — ficam
     com o valor que já tinham (ou default, se a linha for nova).
   - `INSERT INTO calibration_k_applications (...) ON CONFLICT (campaign_id,
     phase) DO UPDATE SET k_approved=excluded.k_approved, ...` — três vezes,
     uma por fase (`'ÓLEO'`, `'GÁS'`, `'ÁGUA'` — strings literais idênticas
     às já usadas na migração/import). Só a linha `'ÓLEO'` recebe
     `applied_at`/`responsible`/`evidence_id` (de `k.date`/`k.responsible`/
     `k.evidence` — mesma regra assimétrica que o `GET` já usa hoje pra ler
     esses três campos só de `kByPhase["ÓLEO"]`). A fase
     `'HC_DIAGNÓSTICO'` (existe no banco, não existe no `Campaign` do
     Metrolog) não é tocada por este endpoint.
   - `INSERT INTO calibration_uncertainty (...) ON CONFLICT (campaign_id,
     condition) DO UPDATE SET u_mpfm_hc_pp=excluded.u_mpfm_hc_pp,
     u_ref_hc_pp=excluded.u_ref_hc_pp` — uma vez pra `AS_FOUND`, uma pra
     `POST_K`. `u_mpfm_total_pp`/`u_ref_total_pp`/`k_mpfm`/`k_ref`/
     `source_version`/`status` não são tocados.
5. Sucesso → recarrega a campanha via `loadCalibrationCampaign` (mesma função
   do `GET`) e devolve `{ status: "ok", campaign }` — mesmo shape do `GET`,
   já refletindo o que foi de fato persistido (inclusive se o `campaign_id`
   mudou).
6. Erro de banco → `500` com mensagem genérica, mesmo padrão de tratamento já
   usado no `GET` (`no such table`/`D1_ERROR` vira mensagem amigável, resto
   vira "Falha ao gravar a base real.").

## CORS

Mesma política do `GET` (regex `localhost`/`127.0.0.1` — nunca `*`). Ajustes:
- `OPTIONS` passa a anunciar `Access-Control-Allow-Methods: GET, PUT`.
- `OPTIONS` passa a anunciar `Access-Control-Allow-Headers: Content-Type`
  (necessário pro preflight de um `PUT` com corpo JSON cross-origin — o
  `GET` de hoje não precisa disso por não ter corpo).

## Frontend (`apps/calibration/src/main.tsx`)

A função `save()` de hoje só grava no `localStorage`:

```tsx
const save=()=>{localStorage.setItem('mpfm-campaign',JSON.stringify(c));flash('Campanha salva neste navegador.')};
```

Passa a também chamar a API (best-effort — se a API falhar, ainda salva
local e avisa, não trava o usuário). URL **relativa** (`/api/calibration`),
não absoluta com host/porta fixos: desde a Fase 1 o Metrolog é servido a
partir de `public/calibracao/` no mesmo domínio do Portal SGM (mesma origem
que `app/api/calibration`), então uma chamada relativa já resolve certo tanto
em dev (`npm run dev` no root, servindo `/calibracao/` + `/api/calibration`
juntos) quanto em produção. Rodando `apps/calibration` isolado (seu próprio
`npm run dev`, porta diferente, sem a rota da API) a chamada relativa erra
(404/network error) e cai no `catch` — degrada pro comportamento de hoje
(só `localStorage`), o que é aceitável para esse modo de iteração isolada:

```tsx
const save=async()=>{
  localStorage.setItem('mpfm-campaign',JSON.stringify(c));
  try{
    const res=await fetch(`/api/calibration?campaignId=${encodeURIComponent(c.id)}`,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:c.id,revision:c.revision,nature:c.nature,asset:c.asset,well:c.well,tag:c.tag,serial:c.serial,reference:c.reference,start:c.start,end:c.end,postStart:c.postStart,postEnd:c.postEnd,pb:c.pb,hcLimit:c.hcLimit,totalLimit:c.totalLimit,pvtLimit:c.pvtLimit,kMin:c.kMin,kMax:c.kMax,minRecords:c.minRecords,pvtMonths:c.pvtMonths,timezone:c.timezone,responsible:c.responsible,approver:c.approver,envelope:c.envelope,pvt:c.pvt,uncertainty:c.uncertainty,k:c.k,evidence:c.evidence,approvals:c.approvals}),
    });
    if(!res.ok) throw new Error(String(res.status));
    flash('Campanha salva no navegador e na base real.');
  }catch{
    flash('Campanha salva neste navegador (base real indisponível).');
  }
};
```

CORS continua existindo no endpoint (não é removido) pra não quebrar quem
ainda roda `apps/calibration` isolado contra a API do root em dev — só deixa
de ser o caminho principal de integração, que agora é same-origin.

## Fora de escopo (Fase 2)

- Qualquer tela nova (Fase 3).
- Criar campanha nova via API (continua só via script de import).
- Editar/gravar `rows` (MPFM/separador) ou dados de laboratório via API.
- Autenticação/autorização real — mantém a mesma postura de "ambiente
  restrito" já usada no `GET` (CORS por origem localhost, sem token). Uma
  API de escrita real em produção precisaria de mais que isso, mas isso é
  decisão de produto fora do escopo desta fase interna/de desenvolvimento.

## Testes

- Testes de unidade/integração em `tests/calibration-query.test.mjs` (já
  existe pro `GET`) ganham casos novos para o `PUT`: update de campo escalar,
  upsert de uma linha de PVT/K/incerteza que não existia, tentativa de `PUT`
  em campanha inexistente (`404`), corpo inválido (`400`).
- `apps/calibration`'s próprio `npm test` continua rodando (não deve quebrar
  com a mudança em `save()`).
- Verificação manual: rodar `npm run dev` no root, abrir o Metrolog, editar
  um campo no drawer, salvar, conferir via `GET /api/calibration?campaignId=`
  que o valor persistiu no D1.
