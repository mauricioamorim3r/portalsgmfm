# Fase 3.3 — Grupo C: Importação e Relatórios

## Contexto

Últimas 2 das 9 abas do Metrolog. Os botões "Importar" e "Exportar Excel"
já existem e funcionam — vivem no header (`apps/calibration/src/main.tsx`),
disponíveis em qualquer aba. Esta fase dá a eles uma tela própria com
contexto (o que o arquivo aceito/gerado contém), sem removê-los do header
(mantém o atalho rápido) — as duas abas chamam exatamente os mesmos
`fileRef`/`importFile`/`exportExcel` já existentes, nenhuma lógica nova.

## Objetivo

- **Importação**: explica o formato aceito (Excel com abas `01_CAMPANHA` e
  `IN_01_MPFM`) e repete o botão de selecionar arquivo (mesmo `fileRef`).
- **Relatórios**: explica o conteúdo do Excel gerado (abas `01_CAMPANHA`,
  `IN_01_MPFM`, `03_VALIDACAO`, `06_EXPORTACAO` — nomes exatos que
  `exportExcel()` já usa) e repete o botão de exportar.
- Com isso, as 9 abas do menu passam a ter conteúdo real — `EmConstrucao`
  fica sem nenhum caso de uso ativo (mas o componente continua existindo
  como fallback de segurança do switch).

## Fora de escopo

- Histórico de importações (quando foi a última, por quem) — não existe
  esse dado hoje, criar isso é fora de escopo.
- Qualquer mudança em `importFile`/`exportExcel`.

## Testes

- `apps/calibration`'s `npm test` continua passando.
- Verificação manual: abrir as duas abas, conferir texto e que os botões
  ainda disparam a mesma ação (seletor de arquivo / download do Excel).
