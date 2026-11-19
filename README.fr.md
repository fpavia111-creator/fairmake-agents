# Agents Fairmake pour l'industrie

*Traduit par Claude ; relecture par un locuteur natif en attente. La [README](README.md) anglaise fait foi.*

Trente petits agents MCP pour le back-office des PME industrielles et des distributeurs. Chacun a **une seule tâche**, par exemple coût standard face au coût réel par ordre de fabrication, écart sur prix d'achat, écarts d'inventaire tournant ou déductions des clients de la grande distribution, et ne peut pas agir au-delà. Ils lisent les fichiers que vous exportez déjà de NetSuite, SAP Business One, Epicor, Infor, Acumatica, Fishbowl, JobBOSS, Katana, MRPeasy, QuickBooks Enterprise, de votre MES, GMAO ou système qualité, ainsi que les fichiers EDI 850, 810 et 856 ; ils écrivent leurs rapports sur votre ordinateur et attendent une personne nommée avant tout ce qui déplace de l'argent, envoie un message ou modifie un système en production.

Fait partie de Fair Agents de Mythos Machines. Licence MIT · Node 20 ou plus récent · fichiers locaux uniquement · aucun identifiant · aucune dépendance. Le logiciel est gratuit ; la partie payante est une mise en place à prix fixe sur vos propres fichiers.

## Essayer

```bash
npx -y fairmake-cost-variance demo         # coût standard face au réel par ordre, données fictives
npx -y fairmake-retailer-deductions demo   # déductions des distributeurs face à vos expéditions
```

Chaque agent a une `demo` sur des fichiers fictifs, un `eval` avec ses propres cas de test et un serveur MCP (`npx -y <agent> mcp --root <dossier>`).

## Les agents

**Coûts et marges (7) :** `fairmake-cost-variance` (coût standard face au réel par ordre de fabrication), `fairmake-purchase-price-variance` (écart sur prix d'achat), `fairmake-bom-cost-rollup` (cumul des coûts de nomenclature), `fairmake-overhead-absorption` (absorption des frais généraux), `fairmake-wip-aging` (ancienneté des en-cours), `fairmake-job-margins` (marge devisée face à la marge réelle), `fairmake-landed-cost` (fret entrant, droits et frais de dédouanement).

**Production et méthodes (6) :** `fairmake-bom-routing-gaps` (complétude des nomenclatures et des gammes), `fairmake-scrap-yield` (rebuts face au standard), `fairmake-labor-efficiency` (efficacité par poste de charge), `fairmake-machine-downtime` (disponibilité, MTTR et MTBF depuis le MES), `fairmake-capacity-load` (charge hebdomadaire), `fairmake-preventive-maintenance` (maintenance préventive en retard).

**Stocks et traçabilité (5) :** `fairmake-cycle-counts` (écarts d'inventaire par classe ABC), `fairmake-obsolete-inventory` (stocks lents et obsolètes), `fairmake-shelf-life` (péremption et FEFO), `fairmake-reorder-points` (stock de sécurité et points de commande), `fairmake-lot-traceability` (ruptures dans la chaîne des lots).

**Achats et fournisseurs (4) :** `fairmake-late-purchase-orders` (commandes ouvertes en retard), `fairmake-supplier-scorecards` (évaluation fournisseurs), `fairmake-rebate-claims` (remises et accords de prix), `fairmake-material-certs` (certificats matière face à vos spécifications).

**Clients, EDI et conformité distributeurs (4) :** `fairmake-order-backlog` (carnet de commandes et dates promises), `fairmake-retailer-deductions` (déductions et pénalités), `fairmake-edi-asn-errors` (avis d'expédition face aux commandes), `fairmake-edi-invoice-check` (factures face aux commandes clients).

**Qualité, sécurité et douane (4) :** `fairmake-calibration-due` (échéances d'étalonnage), `fairmake-ncr-capa-aging` (non-conformités et actions correctives), `fairmake-osha-300-log` (complétude du registre des accidents), `fairmake-hts-codes` (cohérence des codes tarifaires).

## Sécurité

- **Une tâche par agent.** Tout autre nom d'outil est bloqué.
- **Rien d'engageant ne se fait seul.** Aucun agent ne passe d'écriture dans l'ERP, ne paie, n'expédie, ne modifie un standard ou un planning, ne lève un blocage, ne transmet d'EDI, ne déclare à une administration ni n'envoie de message. Les brouillons sont marqués DRAFT ; l'approbation exige toujours le clic d'une personne nommée, même en mode Auto.
- **Données personnelles masquées.** Les noms des salariés apparaissent pour le modèle d'IA sous forme de jetons comme `A.R.#3f9a2c` ; les fichiers sur votre ordinateur gardent les vraies valeurs.
- **Fichiers locaux uniquement**, pas de réseau, un journal d'audit chaîné sous `.fairmake/`.
- **Vos règles.** Tolérances, objectifs, délais, pénalités, spécifications et listes de codes sont des réglages dans votre propre fichier.

## Tests

{TESTS} tests et {EVALS} cas d'évaluation passent sous Windows avec Node 24 ; les passes d'entrées hostiles ne trouvent rien. Détails dans [REVIEW-ver1.md](REVIEW-ver1.md).

## Limites

Les dispositions de colonnes des exports nommés viennent de la connaissance de ces systèmes, pas d'un compte réel. Tolérances, pénalités, spécifications et codes tarifaires sont vos réglages. Pas de conseil juridique, fiscal, douanier, de sécurité ou comptable.

MIT © 2026 Kurt Francisco
