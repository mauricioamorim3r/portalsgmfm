# Portal MPFM — Calibração e Desempenho

Aplicação React/TypeScript baseada no arquivo `MPFM_P4_V2_3_Graficos(2).xlsx`.

## Executar

```bash
npm install
npm run dev
```

Abra o endereço indicado pelo Vite no navegador.

## Validar

```bash
npm test
npm run build
```

## Recursos implementados

- dashboard executivo responsivo;
- importação do Excel original;
- recálculo de massas, desvios, K-factors, incerteza e En;
- matriz dos 16 gates;
- formulário de campanha com validação imediata;
- persistência local no navegador;
- gráficos de comparação e estabilidade;
- exportação de Excel com campanha, dados horários, gates e resultados.

## Limite da primeira versão

O Excel exportado contém as informações preenchidas e calculadas em um arquivo novo. A preservação integral dos estilos, gráficos e fórmulas do template original deve ser implementada no próximo ciclo por preenchimento direto do pacote OOXML do modelo.
