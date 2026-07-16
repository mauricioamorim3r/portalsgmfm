# PRD — MPFM Calibração v2 (standalone)

## Problema original
> Vamos analisar nos arquivos e trabalhar apenas no módulo da calibração do
> mpfm, o outro módulo que faz a análise do arquivo e armazena o dados que
> entra no módulo de calibração, nesta aplicação, deixaremos o ingresso das
> informações sendo feita por template Excel ou manual.

## Escolhas do usuário (session 1 — 2026-07-16)
- **Extração automática** (BASE_UNICA_MES + separador): manter (arquivos existem para ingestão) e melhorar
- **Melhorias**: permitir importar OU editar; editar o que foi importado
- **Backend Portal SGM** (`/api/calibration*`): removido — módulo 100 % standalone
- **Persistência**: SQLite (sql.js WASM) no navegador + `localStorage`
- **Build**: rebuild automático em `public/calibracao-v2/`
- **Não mexer** no `apps/calibration/` já publicado no GitHub

## Arquitetura
- Novo módulo isolado: `/app/apps/calibration-v2/`
  - Vite 5 + React 18 + TypeScript
  - `sql.js` (SQLite compilado para WASM) — WASM hospedado em `public/`
  - `xlsx` para leitura/escrita de Excel
  - `lucide-react` para ícones
- Sem backend. Sem chamadas `/api/*`.
- Build estático em `/app/public/calibracao-v2/` (também rodando via
  vite preview em porta 3000, supervisor program `calibrationv2`).
- `apps/calibration/` (v1) e `public/calibracao/` (v1 buildado) — **intocados**.

## Estrutura de código
```
apps/calibration-v2/
├── index.html, package.json, tsconfig.json, vite.config.ts
├── public/
│   ├── sql-wasm.wasm         (sql.js runtime — hospedado localmente)
│   └── sql-wasm-browser.wasm
└── src/
    ├── main.tsx              App shell + 10 abas (React components)
    ├── engine.ts             calculate() metrologia + 16-gate matrix
    ├── types.ts              Campaign, Row, SeparatorRow + factories
    ├── db.ts                 sql.js + localStorage persistence
    ├── parsers.ts            Excel: template + BASE_UNICA_MES + separador
    ├── exporter.ts           Excel export (5 abas)
    └── styles.css            CSS (mantém identidade visual do v1)
```

## Requisitos de core (estáticos)
- 10 abas: Visão geral, Campanha, Importação, MPFM, Separador,
  Laboratório/PVT, Fatores K, Pós-K, Evidências, Relatórios
- Ingresso de dados: (a) Template Excel (`01_CAMPANHA` + `IN_01_MPFM`),
  (b) Extração automática (`BASE_UNICA_MES` + separador dia/hora),
  (c) Adição/edição manual linha-a-linha
- Motor metrológico com 16 gates (G01–G16) e KPIs (desvio HC/Total, En, K)
- Persistência SQLite local + backup localStorage
- Multi-campanha: seletor no header, criar/excluir/switch
- Export/import do banco `.sqlite`
- Export Excel da campanha

## Implementado (2026-07-16)
- [x] Novo projeto `apps/calibration-v2/` com Vite + React 18
- [x] Persistência SQLite via sql.js + localStorage (blob base64)
- [x] Multi-campanha (list/create/switch/delete)
- [x] Export/Import do banco `.sqlite`
- [x] Todas as 10 abas funcionando
- [x] Parsers Excel: template completo, BASE_UNICA_MES (MPFM mensal),
      separador (blocos dia/hora)
- [x] Extração por janela (As-Found / Pós-K) com merge dedup por
      `(condição, timestamp)`
- [x] **Edição inline** na aba MPFM e Separador (add row, edit cells,
      toggle usar, delete row com confirmação)
- [x] Filtro por condição (Todas / As-Found / Pós-K)
- [x] Motor 16-gate + KPIs no Overview
- [x] Export Excel com 5 abas (campanha, MPFM, separador, gates, resultado)
- [x] Zero chamadas `/api/*`
- [x] `data-testid` em todos elementos interativos
- [x] Build integrado em `public/calibracao-v2/`
- [x] Testado via testing agent — ~93% de sucesso (todos fluxos críticos OK)

## Backlog
- P1: quebrar `main.tsx` (~1000 linhas) em arquivos por aba
- P2: date picker localizado pt-BR (hoje usa native input)
- P2: 16-gate cells acessíveis por teclado (hoje só visual)
- P2: gráficos Recharts na Visão geral (hoje SVG inline)
- P3: undo/redo para edições de linha

## Próximas tarefas
- Validar com dados reais de campanha (Excel BASE_UNICA_MES) do usuário
- Publicar via "Save to GitHub" (rota `public/calibracao-v2/`)
