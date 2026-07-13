# Qualidade de dados — Óleo Linear

Fonte: `Óleo Linear (1).xlsx` · aba `Export` · SHA-256 `86450d0124da93d3d36c56115040942eff9d46f4cf8dc70783cbbd6e5ed08be3`

Grão: Uma linha por TAG e intervalo diário de medição.

## Perfil

- 876 linhas úteis e 114 colunas;
- 4 TAGs;
- datas de medição de 2025-11-28T00:00:00 a 2026-07-07T00:00:00 (fim do último intervalo: 2026-07-08T00:00:00);
- 0 duplicidades na chave composta (0.0%).

## Classificação inicial

| Regra | Linhas | Taxa | Situação | Severidade |
|---|---:|---:|---|---|
| Campos obrigatórios ausentes | 0 | 0.0% | Ausente | critical |
| Falha instrumental registrada | 0 | 0.0% | Em validação | high |
| Fluxo com P/T iguais a zero | 21 | 2.4% | Em validação | high |
| Zero com totalizador estável e P/T zero | 376 | 42.92% | Não avaliável | medium |
| Zero com totalizador estável e P/T presentes | 0 | 0.0% | Em validação | medium |
| Zero sem causa determinada | 0 | 0.0% | Em validação | high |
| Leitura com volume e P/T presentes | 479 | 54.68% | Derivado | info |

## Limitações

- As categorias de zero são hipóteses auditáveis, não causas operacionais confirmadas.
- A classificação final depende de alinhamento, estado operacional, seleção do ponto e evidência de falha/substituição.
- Nenhum indicador desta análise autoriza o uso do rótulo Conforme.
