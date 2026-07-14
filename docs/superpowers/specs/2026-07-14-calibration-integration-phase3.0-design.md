# Fase 3.0 — Shell de troca de tela por aba

## Contexto

Continuação do projeto de integração do módulo de calibração (ver
[Fase 1](2026-07-14-calibration-integration-phase1-design.md) e
[Fase 2](2026-07-14-calibration-integration-phase2-design.md)). Fase 3 vai
transformar as 9 abas do menu do Metrolog (`apps/calibration/src/main.tsx`,
array `nav`) em telas reais e editáveis. Hoje, clicar em qualquer aba só
troca o estado `active` e destaca o botão — o `<section className="page">`
inteiro (título, steps, status-band, KPIs, gráficos, matriz de gates,
pendências) é sempre o conteúdo de "Visão geral", não importa qual aba está
selecionada.

Antes de construir qualquer tela nova (Fase 3.1+, por grupo — ver decisão de
priorização registrada na conversa: Grupo A primeiro — Campanha/Fatores
K/Pós-K/PVT), o shell precisa realmente trocar de conteúdo por aba. Esta
sub-fase (3.0) é só isso — mecânico, sem tela nova de verdade ainda.

## Objetivo

- `App()` renderiza conteúdo diferente conforme `active`.
- "Visão geral" continua mostrando exatamente o dashboard atual (extraído
  pra um componente `Overview`, comportamento idêntico).
- As outras 8 abas mostram um estado "em construção" — nome da aba +
  aviso claro de que a tela ainda não existe. **Nunca** um placeholder que
  pareça dado real (consistente com a regra do projeto de nunca simular
  dado — mesmo padrão do "Não avaliável" que o Portal SGM já usa pra
  Desempenho MPFM).
- Zero mudança de cálculo, API, ou dado. Só roteamento de UI.

## Design

Em `apps/calibration/src/main.tsx`, dentro de `App()`:

1. Extrair o bloco atual de `<div className="title-row">` até o fechamento
   de `<div className="dashboard-grid">` (hoje sempre renderizado) pra um
   componente `Overview({ c, r, setDrawer })` — mesmo JSX, sem alteração de
   comportamento, só movido pra função própria.
2. Adicionar um componente `EmConstrucao({ tab })`:
   ```tsx
   function EmConstrucao({tab}:{tab:string}){return <div className="empty"><div><b>{tab}</b><br/>Tela ainda não implementada.</div></div>}
   ```
   Reaproveita a classe `.empty` que já existe em `styles.css` (hoje usada
   pelo `SparkChart` quando não há dados).
3. Dentro do `return` de `App()`, trocar o `<section className="page">`
   fixo por um lookup por `active`:
   ```tsx
   {active==='Visão geral'?<Overview c={c} r={r} setDrawer={setDrawer}/>:<EmConstrucao tab={active}/>}
   ```
   dentro da mesma `<section className="page">` (mantém o wrapper,
   só troca o conteúdo interno).

## Fora de escopo

- Conteúdo real de qualquer uma das 8 abas — isso é Fase 3.1 em diante, por
  grupo (Grupo A primeiro: Campanha, Fatores K, Pós-K, Laboratório/PVT).
- Qualquer mudança de API, cálculo, ou dado.

## Testes

- `apps/calibration`'s `npm test` (`engine.test.ts`) continua passando —
  não testa UI/rendering, só `calculate()`, que não muda.
- Verificação manual: build, servir em `/calibracao/`, clicar cada uma das
  9 abas, confirmar que "Visão geral" mostra o dashboard de sempre e as
  outras 8 mostram o aviso "em construção" com o nome certo da aba.
