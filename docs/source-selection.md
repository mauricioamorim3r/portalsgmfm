# Seleção de fontes para o Portal SGM

## Baseline da aplicação

- Projeto Sites: `Portal SGM - Sistema de Gestão de Medição`.
- Baseline local: versão publicada 6, commit `f0f2791ffaf16c7b3f473591b66a86e900d72f3b`.
- Acesso confirmado como restrito ao proprietário.

## Fonte local inspecionada

- Raiz: `C:\MPFM\NOVO\Painel_Operador`.
- Inventário: 13.112 arquivos.
- Duplicidades exatas fora de dependências e builds: 1.230 grupos.
- O inventário detalhado em CSV permanece somente na máquina local porque nomes de documentos e caminhos podem ser confidenciais.

## Recursos selecionados

| Recurso | Origem | Uso no portal | Tratamento |
|---|---|---|---|
| Regras de validação e rastreabilidade | `dashboard-anp-radar/docs/REGRAS_RADAR.md` | Referência para regras auditáveis | Consultado; não copiado integralmente |
| Arquitetura do Radar ANP | `dashboard-anp-radar` | Referência para ingestão, evidências e trilha | Código não copiado nesta fase |
| Óleo Linear válido | `C:\Users\mauri\Downloads\Óleo Linear (1).xlsx` | Perfil de qualidade e classificação inicial dos zeros | Somente agregados, período, hash e regras foram incorporados |

## Recursos excluídos da publicação

- medições brutas;
- números de série;
- documentos, certificados, XMLs e planilhas de origem;
- caminhos locais de arquivos;
- inventário detalhado do acervo;
- chaves, configurações locais de IA, caches e bancos SQLite do Radar ANP;
- `node_modules`, `dist`, releases e arquivos temporários de teste.

## Divergência confirmada

A planilha válida contém 876 linhas úteis, e não 877. As quatro TAGs possuem 219 registros cada. As outras duas linhas após os dados são uma linha vazia e uma nota de filtros, além da linha de cabeçalho.
