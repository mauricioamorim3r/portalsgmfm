# Fase 4 — Criar campanha de calibração do zero ("Solicitar calibração")

## Contexto

Continuação do projeto de integração da calibração (Fases 1-3 já entregues
e revisadas). Até aqui, `POST` nunca existiu — `PUT /api/calibration`
(Fase 2) só atualiza campanha já existente, e criar campanha nova era
exclusividade do script `scripts/import-mpfm-calibration.py`, rodado por
fora do app. Decisão tomada na conversa: essa restrição muda agora — o
app ganha um fluxo próprio de criação ("Solicitar calibração"), disparando
a sequência completa que o usuário descreveu (janelas → PVT → Fatores K →
monitoramento), que fases seguintes (5 e 6) vão completar.

Este documento cobre **só a criação da campanha** — o primeiro passo do
wizard. As janelas de data/hora e a extração de Excel de produção
(MPFM/separador) ficam pra Fase 5.

## Objetivo

- `POST /api/calibration` cria uma campanha nova. Corpo = mesmo shape do
  `PUT` (`CampaignInput` — Fase 2), pra reaproveitar validação e as
  mesmas tabelas relacionadas (PVT/K/incerteza ficam com linhas vazias
  desde a criação, prontas pro fluxo normal preencher depois).
- Botão "Solicitar calibração" no header do Metrolog abre um modal com os
  campos básicos (mesmo conjunto do drawer "Editar campanha" hoje: ID,
  ativo, poço, TAG, série, referência, + revisão/natureza/responsável/
  aprovador). Ao criar, o app passa a exibir a campanha nova e vai direto
  pra aba Campanha, pra o usuário continuar preenchendo (envelope,
  evidências etc. — tudo que a Fase 3.1 já construiu).

## Design

### Backend

`createCalibrationCampaign(db, input)` em `db/calibration-write.ts`
(mesmo arquivo do `saveCalibrationCampaign` da Fase 2 — reaproveita as
constantes `UPSERT_PVT_SQL`/`UPSERT_K_OLEO_SQL`/`UPSERT_K_SIMPLE_SQL`/
`UPSERT_UNCERTAINTY_SQL` já existentes ali):

1. `SELECT id FROM calibration_campaigns WHERE campaign_id = ?` — se já
   existe, retorna `{ok:false,reason:"conflict"}` (o `POST` handler
   traduz isso pra `409`).
2. `INSERT INTO calibration_campaigns (...)` com os mesmos campos
   escalares/envelope/evidence/approvals que o `PUT` já grava — usando
   `.run()` (novo método no `D1Statement`, que **D1 real já tem
   nativamente** — `D1PreparedStatement.bind()` sempre retornou algo com
   `.run()`, só não estava no nosso tipo mínimo ainda) pra capturar
   `meta.last_row_id` da linha recém-criada.
3. Com esse `id`, roda o mesmo `db.batch([...])` de upserts PVT (AS_FOUND
   e POST_K com valores vazios/zero), K (ÓLEO/GÁS/ÁGUA vazios) e
   incerteza (AS_FOUND/POST_K vazios) que o `PUT` já usa — deixa as
   tabelas relacionadas com linha existente (não `NULL` por ausência de
   linha), prontas pra Fase 5/edição normal fazer upsert nelas depois.
4. Retorna `{ok:true,id}`.

`POST /api/calibration` (mesmo arquivo de rota do `GET`/`PUT`, Fase 2):
- Sem `campaignId` na query — o identificador vem do corpo (`input.id`).
- Body inválido → `400` (reaproveita `parseCampaignInput`, já existente).
- Conflito (`campaign_id` já existe) → `409`.
- Sucesso → `201`, recarrega via `loadCalibrationCampaign` e devolve
  `{status:"ok",campaign}` — mesmo formato do `GET`/`PUT`.
- `OPTIONS` passa a anunciar `GET, PUT, POST`.

### Frontend

- `NovaCampanhaModal` — mesmo padrão visual do `Drawer` existente
  (`.drawer-scrim`/`.drawer`/`.form`), formulário com os 10 campos
  básicos (ID, ativo, poço, TAG, série, referência, revisão, natureza,
  responsável, aprovador). Envia um `Campaign` "em branco" (todo o resto
  — envelope, PVT, incerteza, K, evidence/approvals — com valores vazios/
  nulos/zero, mesma convenção que campos ausentes já usam no resto do
  app) mais os 10 campos preenchidos, via `POST`.
- Botão novo no header (`Plus` do `lucide-react`, ainda não importado)
  abre o modal.
- Ao criar com sucesso: o app troca o estado `c` pra campanha recém-
  criada, salva no `localStorage` (mesma convenção do `save()`), muda pra
  aba "Campanha", e mostra um toast de sucesso — usuário continua o
  preenchimento normalmente dali.
- Erro de criação (ID duplicado, campo obrigatório vazio, base
  indisponível) aparece dentro do próprio modal, sem fechar.

## Fora de escopo

- Selecionar entre múltiplas campanhas existentes (o app continua
  mostrando uma campanha por vez — a criada mais recentemente ou a
  buscada no carregamento). Uma tela de "lista de campanhas" fica pra
  quando for realmente necessária, não foi pedida agora.
- Janelas de data/hora, upload de Excel de produção, extração de linhas
  — Fase 5.

## Testes

- `tests/calibration-write.test.mjs` ganha casos pra
  `createCalibrationCampaign`: cria com sucesso (confere `id` retornado e
  que `loadCalibrationCampaign` acha a campanha nova com os campos
  certos e listas PVT/K/incerteza já com linha, mesmo vazias); retorna
  conflito pra `campaign_id` já existente (usa a campanha semeada
  `RVD-MPFM-COM-05-26` como o "já existe").
- `apps/calibration`'s `npm test` continua passando.
- Verificação manual: abrir o modal, criar campanha com ID novo, conferir
  que aparece na tela e persiste (via `GET`); tentar criar de novo com o
  mesmo ID e ver o erro de conflito aparecer no modal.
