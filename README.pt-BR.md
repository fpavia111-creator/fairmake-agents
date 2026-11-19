# Agentes Fairmake para a indústria

*Traduzido pelo Claude; revisão por falante nativo pendente. Vale a [README](README.md) em inglês.*

Trinta pequenos agentes MCP para o back office de indústrias e distribuidores de pequeno e médio porte. Cada um tem **uma única tarefa**, como custo padrão frente ao real por ordem de produção, variação do preço de compra, divergências da contagem cíclica ou deduções de varejistas, e não pode agir fora dela. Eles leem os arquivos que você já exporta do NetSuite, SAP Business One, Epicor, Infor, Acumatica, Fishbowl, JobBOSS, Katana, MRPeasy, QuickBooks Enterprise, do seu MES, CMMS ou sistema de qualidade, e arquivos EDI 850, 810 e 856; gravam os relatórios no seu computador e esperam uma pessoa nomeada antes de movimentar dinheiro, enviar mensagens ou alterar um sistema em produção.

Parte do Fair Agents da Mythos Machines. Licença MIT · Node 20 ou mais recente · somente arquivos locais · sem credenciais · sem dependências. O software é gratuito; a parte paga é uma implantação a preço fixo nos seus próprios arquivos.

## Experimente

```bash
npx -y fairmake-cost-variance demo         # custo padrão frente ao real por ordem, dados fictícios
npx -y fairmake-retailer-deductions demo   # deduções de varejistas frente aos seus embarques
```

Cada agente tem uma `demo` com arquivos fictícios, um `eval` com seus próprios casos e um servidor MCP (`npx -y <agente> mcp --root <pasta>`).

## Os agentes

**Custos e margem (7):** `fairmake-cost-variance` (custo padrão frente ao real por ordem de produção), `fairmake-purchase-price-variance` (variação do preço de compra), `fairmake-bom-cost-rollup` (rollup de custos da estrutura de produto), `fairmake-overhead-absorption` (absorção de custos indiretos), `fairmake-wip-aging` (envelhecimento do estoque em processo), `fairmake-job-margins` (margem orçada frente à real), `fairmake-landed-cost` (frete de entrada, impostos de importação e despachante).

**Produção e engenharia (6):** `fairmake-bom-routing-gaps` (completude de estruturas e roteiros), `fairmake-scrap-yield` (refugo frente ao padrão), `fairmake-labor-efficiency` (eficiência por centro de trabalho), `fairmake-machine-downtime` (disponibilidade, MTTR e MTBF a partir do MES), `fairmake-capacity-load` (carga semanal), `fairmake-preventive-maintenance` (manutenção preventiva atrasada).

**Estoque e rastreabilidade (5):** `fairmake-cycle-counts` (divergências de contagem por classe ABC), `fairmake-obsolete-inventory` (estoque de giro lento e obsoleto), `fairmake-shelf-life` (validade e FEFO), `fairmake-reorder-points` (estoque de segurança e pontos de pedido), `fairmake-lot-traceability` (quebras na cadeia de lotes).

**Compras e fornecedores (4):** `fairmake-late-purchase-orders` (pedidos de compra em aberto e atrasados), `fairmake-supplier-scorecards` (avaliação de fornecedores), `fairmake-rebate-claims` (rebates e acordos de preço), `fairmake-material-certs` (certificados de material frente às suas especificações).

**Clientes, EDI e conformidade com varejistas (4):** `fairmake-order-backlog` (carteira de pedidos e datas prometidas), `fairmake-retailer-deductions` (deduções e estornos), `fairmake-edi-asn-errors` (avisos de embarque frente aos pedidos), `fairmake-edi-invoice-check` (faturas frente aos pedidos de clientes).

**Qualidade, segurança e comércio exterior (4):** `fairmake-calibration-due` (vencimentos de calibração), `fairmake-ncr-capa-aging` (não conformidades e ações corretivas), `fairmake-osha-300-log` (completude do registro de acidentes), `fairmake-hts-codes` (consistência dos códigos tarifários).

## Segurança

- **Uma tarefa por agente.** Qualquer outro nome de ferramenta é bloqueado.
- **Nada vinculante acontece sozinho.** Nenhum agente lança no ERP, paga, expede, altera padrões ou programações, libera bloqueios, transmite EDI, declara a órgãos ou envia mensagens. Os rascunhos são marcados DRAFT; aprovar sempre exige o clique de uma pessoa nomeada, mesmo no modo Auto.
- **Dados pessoais mascarados.** Nomes de funcionários chegam ao modelo de IA como códigos como `A.R.#3f9a2c`; os arquivos no seu computador mantêm os valores reais.
- **Somente arquivos locais**, sem rede, com um registro de auditoria encadeado em `.fairmake/`.
- **Suas regras.** Tolerâncias, metas, prazos, multas, especificações e listas de códigos são configurações no seu próprio arquivo.

## Testes

794 testes e 608 casos de avaliação passam no Windows com Node 24; as passagens com entradas hostis não encontram nada. Detalhes em [REVIEW-ver1.md](REVIEW-ver1.md).

## Limites

Os layouts de colunas das exportações nomeadas vêm do conhecimento desses sistemas, não de uma conta real. Tolerâncias, multas, especificações e códigos tarifários são suas configurações. Não é aconselhamento jurídico, tributário, aduaneiro, de segurança ou contábil.

MIT © 2026 Kurt Francisco
