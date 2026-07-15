# Fase 5 — Extração de janela MPFM/Separador do Excel de produção

## Contexto

Continuação do projeto (Fases 1-4 entregues). Decisão já tomada: dados de
leitura (MPFM, separador) não são digitados manualmente — entram via os
próprios Excel de produção que o usuário já sobe hoje pro pipeline principal
do Portal SGM (`MPFM_JUN_2026.xlsx`/`MPFM_JUL_2026.xlsx`, mensais;
`SEP_Dados.xlsx`, um arquivo pro período todo). Esta fase deixa o **próprio
fluxo de calibração** ler esses arquivos, filtrar pela janela (As-Found ou
Pós-K) que o usuário definiu na campanha, e gravar as linhas
(`calibration_mpfm_rows`/`calibration_separator_rows`) — sem depender do
pipeline de produção principal já ter rodado pra aquele período.

## Achados da investigação (documentando pra não perder o porquê)

- **`MPFM_*.xlsx`** tem 6 abas; a que interessa é `BASE_UNICA_MES` (84
  colunas, todas granularidades misturadas via coluna `Granularity`).
  `DAILYS`/`HOURLYS` também existem, têm 3 colunas a mais (`dP - Inlet
  (mbar)`, `GVF (%)`, `WVF (%)`, `WLR (%)`) — mas a coluna `Instrumento`
  dessas duas abas **está com bug**: repete o valor de `Tag` (nome do
  poço, ex: `Riser_P4`) em vez do código real do instrumento (ex:
  `13FT0317`). Só `BASE_UNICA_MES` tem o código certo. Decisão: extrair de
  `BASE_UNICA_MES`, filtrando por `Instrumento` = `c.tag` e `Granularity`
  = `'Hourly'`. `dp_kpa`/`gvf_pct`/`wlr_pct` ficam `null` (essas 3 colunas
  não existem em `BASE_UNICA_MES`, e nos arquivos atuais estão vazias em
  `DAILYS`/`HOURLYS` também — sem perda real hoje).
- `ProductionDate` é string `'YYYY-MM-DD'`, `Hour` é string `'HH:00'`
  (ex: `'02:00'`) — junto viram timestamp `${ProductionDate}T${Hour}:00`.
- **`SEP_Dados.xlsx`** tem 3 abas por fase (`separador oleo`/`separador
  gas`/`separador agua`), cada uma em blocos: uma linha `"Data:
  YYYY-MM-DD | TAG: ... | Meter ID: ..."` marca o dia, a linha seguinte
  `"DAY"` é o total diário (ignorado — só queremos leituras horárias), e
  as próximas linhas têm a hora como string `'1'` a `'24'` (convenção
  hora-início: assumindo hora `'1'`→`00:00`, `'24'`→`23:00` — **premissa
  documentada, não confirmada com o usuário**; se divergir da convenção
  real do medidor, é só ajustar o `-1` na conversão de hora).
- Mapeamento pra uma linha combinada de `calibration_separator_rows` por
  timestamp (mescla as 3 abas por dia+hora):
  - `pressure_barg`/`temperature_c` ← aba óleo, colunas `Pressure (barg)`
    (índice 4) / `Temperature (deg c)` (índice 5) — usada como referência
    única pro trio.
  - `oil_gv_line_m3` ← óleo, `GV (m³)` (índice 9).
  - `oil_rho_coriolis_kgm3` ← óleo, `D - CORIOLIS (Óleo)` (índice 17 —
    mais específica que a genérica `MD (kg/m³)`).
  - `oil_mass_direct_t` ← óleo, `Mass (t)` (índice 11 — a direta, não a
    `Mass (t) CALC` no índice 18).
  - `gas_mass_t` ← gás, `Mass (t)` (índice 9).
  - `gas_std_ksm3` ← gás, `St. vol. (m³)` (índice 8) ÷ 1000.
  - `water_mass_t` ← água, `Mass (t)` (índice 10).
  - `water_vol_m3` ← água, `GV (m³)` (índice 8).
  - `duration_h` = 1, `quality` = `''`, `source_ref` = nome do arquivo.

## Objetivo

- Campos de janela (`start`/`end`/`postStart`/`postEnd`) ganham input na
  aba Campanha (já existem no tipo `Campaign` e na API — só faltava tela).
- Aba Importação ganha 2 seletores de arquivo (Excel MPFM, Excel
  Separador) + 2 botões ("Carregar janela As-Found" / "Carregar janela
  Pós-K"). Ao clicar, o navegador parseia os arquivos com a lib `xlsx`
  (já é dependência do app), filtra pela janela e TAG da campanha, e
  envia as linhas extraídas pra uma API nova.
- `PUT /api/calibration/rows?campaignId=&condition=AS_FOUND|POST_K` grava
  as linhas extraídas via upsert (idempotente — reenviar o mesmo arquivo
  atualiza em vez de duplicar).

## Design

### Backend

Novo arquivo `db/calibration-rows-write.ts` (arquivo próprio, separado de
`calibration-write.ts` que já cuida do nível-campanha — mantém arquivos
pequenos/focados):

```ts
export interface MpfmRowInput { timestamp:string; use:boolean; duration:number|null; p:number|null; t:number|null; dp:number|null; gvf:number|null; wlr:number|null; oil:number|null; gas:number|null; water:number|null; oilCorr:number|null; gasCorr:number|null; waterCorr:number|null }
export interface SeparatorRowInput { timestamp:string; use:boolean; durationH:number|null; quality:string; pressureBarg:number|null; temperatureC:number|null; oilGvLineM3:number|null; oilRhoCoriolisKgm3:number|null; oilMassDirectT:number|null; gasMassT:number|null; waterMassT:number|null; gasStdKsm3:number|null; waterVolM3:number|null; sourceRef:string }

export async function saveCalibrationRows(
  db: D1Batchable, campaignId: string, condition: 'AS_FOUND'|'POST_K',
  mpfmRows: MpfmRowInput[], separatorRows: SeparatorRowInput[],
): Promise<{ ok:true; mpfmCount:number; separatorCount:number } | { ok:false; reason:'not_found' }>
```

- Confirma a campanha existe (mesmo padrão de `saveCalibrationCampaign`).
- Upsert em `calibration_mpfm_rows`/`calibration_separator_rows`, cada
  linha via `ON CONFLICT (campaign_id, condition, timestamp) DO UPDATE`
  (índices únicos já existentes no schema) — reenviar sobrescreve, não
  duplica.
- Um `db.batch([...])` só com todas as linhas (MPFM + separador juntas).

`corsHeaders` sai de `app/api/calibration/route.ts` pra um módulo
compartilhado novo `app/api/calibration/cors.ts` (as duas rotas passam a
importar de lá — pequeno refactor, evita duplicar as 4 linhas da função).

Nova rota `app/api/calibration/rows/route.ts`:
- `PUT` — lê `campaignId` e `condition` da query, valida `condition` é
  `'AS_FOUND'` ou `'POST_K'` (`400` senão), valida corpo
  (`{mpfmRows:[...],separatorRows:[...]}`, cada linha com os campos do
  tipo acima), chama `saveCalibrationRows`, devolve
  `{status:"ok",mpfmCount,separatorCount}`.
- `OPTIONS` própria (mesmo padrão CORS).

### Frontend (`apps/calibration/src/main.tsx`)

- `CampanhaTab` ganha 4 `field(...)` novos (Início/Fim As-Found, Início/
  Fim Pós-K) — reaproveita o `field`/`update` que já existem, zero
  infraestrutura nova.
- Duas funções de parsing novas, module-scope (mesmo estilo denso do
  resto do arquivo):
  - `parseMpfmWindow(file, tag, start, end)` — lê `BASE_UNICA_MES` via
    `XLSX.utils.sheet_to_json(ws,{header:1,raw:true})` (mesmo padrão já
    usado por `importFile`), filtra `Instrumento===tag &&
    Granularity==='Hourly'`, monta timestamp, filtra pela janela
    `[start,end]`, retorna `MpfmRowInput[]`.
  - `parseSeparatorWindow(file, start, end)` — itera as 3 abas
    detectando blocos via regex `Data:\s*(\d{4}-\d{2}-\d{2})` (mesma
    lógica do `scripts/import-real-data.py`, portada pra TS), ignora
    linhas `"DAY"`, junta óleo+gás+água por dia+hora numa
    `SeparatorRowInput` por timestamp, filtra pela janela.
- `ImportacaoTab` ganha props novas (`c`, `onRowsSaved`) e estado local
  pros 2 arquivos selecionados + status de carregamento/erro. Botão
  "Carregar janela As-Found" usa `c.start`/`c.end`; "Carregar janela
  Pós-K" usa `c.postStart`/`c.postEnd`. Ambos: parseia os 2 arquivos (se
  selecionados), `PUT /api/calibration/rows?...`, em sucesso chama
  `onRowsSaved` (que no `App()` recarrega a campanha via
  `GET /api/calibration` pra MPFM/Separador tabs mostrarem as linhas
  novas).

## Fora de escopo

- Cálculo de fator K, equalização, monitoramento de conservação de massa
  — ficam pra Fase 6, que reaproveita esse mesmo mecanismo de extração
  pra janela Pós-K (já coberto aqui) e adiciona só a lógica/tela de
  monitoramento em cima.
- Detectar automaticamente qual condição uma linha pertence — usuário
  sempre escolhe o botão certo antes de subir.
- Corrigir a convenção hora-1-a-24 do separador se a premissa acima
  estiver errada — fica documentada, ajuste é uma linha se necessário.

## Testes

- `tests/calibration-rows-write.test.mjs` (novo arquivo) — testa
  `saveCalibrationRows`: cria linhas novas, reenvio com valor diferente
  atualiza (não duplica), campanha inexistente retorna `not_found`.
- `apps/calibration`'s `npm test` continua passando (não mexe em
  `calculate()`).
- Verificação manual com os arquivos reais (`MPFM_JUN_2026.xlsx`,
  `SEP_Dados.xlsx`, já na raiz do repo, fora do git): definir janela
  As-Found na aba Campanha, subir os 2 arquivos na aba Importação,
  conferir que a aba MPFM/Separador passam a mostrar as linhas extraídas
  reais (não as antigas do script Python).
