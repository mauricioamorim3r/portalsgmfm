# Fase 3.2 — Grupo B: MPFM, Separador, Evidências, Laboratório/PVT (parte lab)

## Contexto

Continuação da Fase 3 (ver Fases 3.0/3.1/3.1.5). Decisão já tomada na
conversa: dados de leitura de sensor (MPFM, separador) e de laboratório
nunca são digitados manualmente no app — entram só via o script
`scripts/import-mpfm-calibration.py` (batch, fora do app). Por isso estas
telas são **só leitura**: mostram o que já está no banco (agora
efetivamente carregado graças à Fase 3.1.5), sem formulário de edição.

## Objetivo

- **MPFM**: tabela com `c.rows` (leituras As-Found/Pós-K já carregadas).
- **Separador**: tabela com `c.raw?.separatorRows`.
- **Laboratório/PVT**: mantém o formulário de PVT da Fase 3.1 (editável) e
  ganha, abaixo, uma tabela só-leitura de `c.raw?.labResults`.
- **Evidências**: resumo/checklist — `evidence`/`approvals` (booleanos,
  editáveis na aba Campanha), gate G10, e `k.evidence` (texto, editável em
  Fatores K) — tudo em modo exibição, com nota de onde editar cada coisa.
- Zero API nova, zero schema novo, zero write novo.

## Design

Uma tabela CSS nova (`.table-wrap`/`table`/`th`/`td`), já que nenhum estilo
de tabela existe em `styles.css` hoje (o app não tinha tabela até agora).

Um helper `numOrDash(n:number|null,d=2)` pra formatar campos opcionais dos
tipos `SeparatorRow`/`LabResult` (que carregam `number|null`, ao contrário
de `Row`, cujos campos numéricos — exceto os `*Corr?` — nunca são nulos).

4 componentes novos (`MPFMTab`, `SeparadorTab`, `EvidenciasTab`) mais uma
extensão do `LaboratorioPvtTab` já existente (adiciona a seção de lab,
sem mudar sua assinatura de props). Cada tabela mostra um estado vazio
("Nenhum registro carregado ainda.") quando a lista está vazia — nunca
inventa linha.

## Fora de escopo

- Editar/excluir/adicionar linha manualmente — provider desses dados
  continua sendo o script de import.
- Sistema de upload de documento pra Evidências — reaproveita os campos
  que já existem (`evidence`,`approvals`,`k.evidence`), não cria tabela
  nova de "itens de evidência".
- Importação, Relatórios — Grupo C, fase seguinte.

## Testes

- `apps/calibration`'s `npm test` continua passando.
- Verificação manual: abrir as 4 abas, conferir que MPFM/Separador/lab
  mostram as linhas reais (mesma contagem que `campaign.raw.*` já expõe:
  48 MPFM, 48 separador, 3 lab, por ex.), e que Evidências reflete
  corretamente o estado atual de `evidence`/`approvals`/G10/`k.evidence`.
