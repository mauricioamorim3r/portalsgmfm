# Fase 3.1.5 — Carregar a campanha real da API no carregamento do app

## Contexto

Achado durante verificação manual da Fase 3.1: o Metrolog nunca busca dado
da API. `useState<Campaign>` só lê `localStorage` ou cai no objeto
`initial` chumbado no código (amostra do zip original). Isso significa:

- Os campos que a Fase 2 já persiste no D1 (`pvt.software`, por exemplo)
  nunca aparecem de verdade na tela — o que aparece é o valor de `initial`
  ou o que sobrou no `localStorage` de uma sessão anterior.
- `campaign.raw` (linhas de separador, resultados de laboratório) nem
  existe no tipo `Campaign` do frontend — não tem pra onde os dados irem
  se a Fase 3.2 (Grupo B: MPFM/Separador/Laboratório) tentar mostrá-los.

Sem corrigir isso, qualquer tela do Grupo B mostraria dado errado ou vazio.

## Objetivo

- No carregamento do app, buscar `GET /api/calibration?campaignId=<id
  atual>` (mesma origem, já resolvido pela Fase 1) e, se a resposta for
  `status:"ok"`, substituir o estado pela campanha real retornada.
- Se a busca falhar (rede indisponível, 404, etc.), mantém o comportamento
  de hoje sem quebrar nada: segue com `localStorage`/`initial`.
- Tipo `Campaign` ganha um campo `raw?` opcional, espelhando o que
  `loadCalibrationCampaign` já retorna (`separatorRows`, `labResults`),
  pros dados existirem no lugar certo pra Fase 3.2 usar.

## Design

Em `apps/calibration/src/main.tsx`:

1. Dois tipos novos, próximos à definição de `Row`/`Campaign`:
   ```tsx
   type SeparatorRow={condition:string,timestamp:string,use_flag:number,duration_h:number|null,quality:string,pressure_barg:number|null,temperature_c:number|null,oil_gv_line_m3:number|null,oil_rho_coriolis_kgm3:number|null,oil_mass_direct_t:number|null,gas_mass_t:number|null,water_mass_t:number|null,gas_std_ksm3:number|null,water_vol_m3:number|null,source_ref:string};
   type LabResult={sample_id:string,use_flag:number,sampled_at:string,sample_type:string,bsw_pct:number|null,rho_oil_std_kgm3:number|null,rho_gas_std_kgsm3:number|null,rho_water_std_kgm3:number|null,fe:number|null,rs:number|null,method:string,report_id:string,status:string};
   ```
   (`use_flag` é `number` — 0/1 — porque `campaign.raw.*` passa direto do
   D1 sem a conversão pra `boolean` que `campaign.rows` já recebe em
   `db/calibration.ts`.)
2. `Campaign` ganha `raw?:{separatorRows:SeparatorRow[],labResults:LabResult[]}`.
3. Em `App()`, um `useEffect` novo (roda uma vez, no mount):
   ```tsx
   useEffect(()=>{
    let active=true;
    fetch(`/api/calibration?campaignId=${encodeURIComponent(c.id)}`)
     .then(res=>res.json())
     .then(data=>{if(active&&data.status==='ok'&&data.campaign)setC(data.campaign)})
     .catch(()=>{});
    return ()=>{active=false};
   },[]);
   ```
   Usa `c.id` (já inicializado por `localStorage`/`initial`) como
   `campaignId` — cobre o caso de a campanha ter sido renomeada numa
   sessão anterior (Fase 3.1 já deixa editar o Campaign ID).

## Fora de escopo

- Qualquer UI nova — isso só corrige a fonte do dado que já existe.
- `pvtRecords`, `kApplications`, `uncertaintyRows` de `campaign.raw` — não
  são consumidos por nenhuma tela ainda (o que interessa pra elas já vem
  achatado em `pvt`/`k`/`uncertainty`), ficam fora do tipo por ora.

## Testes

- `apps/calibration`'s `npm test` continua passando.
- Verificação manual: subir o server, abrir `/calibracao/`, conferir que
  a aba Laboratório/PVT mostra `software:"Calsep PVTSim"` (valor real do
  banco) em vez de `"PVTPack / Calsep"` (valor de `initial`).
