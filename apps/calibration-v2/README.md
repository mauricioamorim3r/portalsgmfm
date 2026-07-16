# MPFM — Calibração v2

Aplicação **standalone** de calibração MPFM. Substitui o portal antigo (`apps/calibration/`):
não depende de nenhum backend, persistência 100 % local em SQLite (sql.js) + `localStorage`.

## Entrada de dados

1. **Template Excel** (mesmo formato do original: abas `01_CAMPANHA` + `IN_01_MPFM`).
2. **Extração automática** a partir do Excel mensal de produção (`BASE_UNICA_MES`) e
   do Excel do separador (blocos dia/hora), com filtro por janela As-Found / Pós-K.
3. **Manual**: qualquer linha (MPFM ou Separador) pode ser adicionada, editada ou
   removida diretamente pela UI. Também é possível editar o que foi importado.

## Executar

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
rm -rf ../../public/calibracao-v2
cp -r dist ../../public/calibracao-v2
```

Servido em `/calibracao-v2/` pelo mesmo Next.js estático que já serve
`/calibracao/` (não altera nada do módulo anterior).

## Persistência

- Estado principal: SQLite (`sql.js` WASM) no navegador
- Backup / hidratação inicial: `localStorage`
- Botão **Exportar DB** salva um arquivo `.sqlite` com todas as campanhas
- Botão **Importar DB** carrega um `.sqlite` previamente exportado
