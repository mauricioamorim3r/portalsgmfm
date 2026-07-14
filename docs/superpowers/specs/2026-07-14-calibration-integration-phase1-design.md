# Fase 1 — Integração do módulo de calibração (plumbing + navegação)

## Contexto

Portal SGM (este repo) e o "Motor MPFM" (apelidado Metrolog na UI), app standalone
de calibração/desempenho MPFM, hoje vivem separados: o Metrolog é distribuído
como `Portal_MPFM_Riser_P4_v1.zip` na raiz do repo (gitignored — política de não
versionar pacotes fonte brutos), rodado à parte, e só troca dados com este repo
via `GET /api/calibration` (somente leitura, `db/calibration.ts` monta o payload
a partir das tabelas `calibration_*`).

Este é o projeto maior de trazer o módulo de calibração para dentro do Portal
SGM, com edição completa e navegação cruzada entre os dois. Ele foi quebrado em
3 fases:

1. **Fase 1 (este documento)** — plumbing: código do Metrolog entra no repo,
   fica navegável a partir do Portal SGM e vice-versa. Nenhuma mudança de dado
   ou comportamento.
2. **Fase 2** — API de escrita (`PUT`/`POST` em `app/api/calibration`) para
   persistir edições no D1 em vez de só `localStorage`.
3. **Fase 3** — as 9 abas do menu do Metrolog (hoje decorativas, não trocam de
   tela) viram views reais e editáveis, ligadas à API da Fase 2.

Este spec cobre **só a Fase 1**.

## Objetivo da Fase 1

- Código-fonte do Metrolog passa a viver dentro deste repo, versionado.
- Um botão no Portal SGM leva ao módulo de calibração.
- Um botão no módulo de calibração leva de volta ao Portal SGM.
- Zero mudança de dado, cálculo ou UI existente em qualquer um dos dois apps
  (fora os dois botões de navegação).

## Por que não integrar como página React dentro do Next/vinext

Cogitado e descartado:

- **Colisão de CSS**: `PortalApp.jsx` usa `className="app"` na raiz; o
  `main.tsx` do Metrolog também usa `.app` e todo um design system próprio
  (`.kpi`, `.panel`, `.gate-grid`, etc. em `src/styles.css`). Importar os dois
  globalmente quebra um ou outro.
- **Risco no bridge RSC/vinext**: o Metrolog usa `xlsx`, `<input type="file">`,
  `localStorage` — tudo client-only. Portá-lo para dentro da árvore
  React/Server-Components do Next arrisca problemas de hidratação/SSR que não
  existem hoje (ele roda como SPA Vite pura).
- **Pipeline de build travado**: `scripts/install-ci.sh` roda exatamente um
  `npm ci` no lockfile do root, com verificação de integridade da tarball do
  `vinext` e timeout apertado; `scripts/build-verified.sh` roda exatamente um
  `vinext build` bounded. Não há suporte a workspaces hoje — arriscado colar
  um segundo projeto npm nesse pipeline sem quebrá-lo.

## Abordagem escolhida

**Servir o build estático do Metrolog em `/calibracao/`, fora do pipeline de
build do Next**, com navegação de página inteira (não client-side route) entre
os dois.

### Onde o código mora

- `apps/calibration/` — source completo do Metrolog (`src/`, `package.json`,
  `package-lock.json`, `index.html`, `README.md`), copiado do zip. Projeto npm
  próprio e independente — `npm install`/`npm run build`/`npm test` rodam
  **de dentro dessa pasta**, não entram em `scripts/install-ci.sh` nem
  `scripts/build-verified.sh`.
- `public/calibracao/` — saída do build (`apps/calibration/dist/*`) commitada
  como estático. O Next serve qualquer coisa em `public/` direto na URL raiz
  (mesmo mecanismo que já serve `favicon.svg`), então isso fica acessível em
  `https://<domínio>/calibracao/` sem tocar `worker/index.ts` nem
  `vite.config.ts`.
- `Portal_MPFM_Riser_P4_v1.zip` é removido da raiz depois da migração — o
  conteúdo dele passa a viver, versionado, em `apps/calibration/`.

### Fluxo de atualização do build estático

Como o build do Metrolog não entra no pipeline automático, o processo manual
(documentado no `CLAUDE.md` e no `README.md` de `apps/calibration/`) é:

```bash
cd apps/calibration
npm install
npm run build
# copia dist/* pra public/calibracao/, sobrescrevendo o que já existia lá
```

Isso é aceitável para a Fase 1 (mudanças raras); uma automação (script /
`postbuild` hook) fica em backlog, fora de escopo aqui.

### Navegação cruzada

- **Portal SGM → Calibração**: novo botão no rodapé do `<aside>` (mesma área
  do bloco "Ambiente restrito" em `src/components/portal/PortalApp.jsx`),
  `<a href="/calibracao/">`, ícone `Gauge` ou similar do `lucide-react` já
  presente. Navegação de página inteira, mesma aba.
- **Calibração → Portal SGM**: no rodapé do `<aside>` do Metrolog
  (`apps/calibration/src/main.tsx`, onde hoje mostra "Motor MPFM v2.1 /
  Campanha local"), adicionar link "Voltar ao Portal SGM" apontando para `/`.
  Mesma aba.

### Fora de escopo (Fase 1)

- Qualquer novo campo editável, aba funcional, ou persistência no D1 — fica
  para Fases 2 e 3.
- Automatizar o build do Metrolog no pipeline principal.
- SSO/estado compartilhado entre os dois apps (cada um mantém seu próprio
  `localStorage`/sessão).

## Testes

- `apps/calibration` mantém seu próprio `npm test` (`vitest run` sobre
  `src/engine.test.ts`) — não integrado ao `npm test` do root.
- Verificação manual: `npm run dev` no root, `npm run build` em
  `apps/calibration`, navegar `/` → clicar botão → chegar em `/calibracao/`
  → clicar "Voltar ao Portal SGM" → voltar pra `/`. Conferir que nenhum CSS de
  um vaza pro outro (visual smoke test via Playwright, como já feito
  manualmente antes deste spec).

## Riscos conhecidos

- **Assets absolutos**: `apps/calibration/dist/index.html` referencia
  `/assets/index-*.js` e `/assets/index-*.css` com caminho absoluto
  (`/assets/...`, não `/calibracao/assets/...`). Isso vai colidir com
  qualquer coisa em `public/assets/` do Portal SGM (hoje não existe, mas é
  frágil) e quebra se o Metrolog não estiver servido exatamente na raiz do
  domínio. Precisa setar `base: '/calibracao/'` no `vite.config.ts` do
  Metrolog antes de buildar, para os assets saírem prefixados
  corretamente (`/calibracao/assets/...`).
