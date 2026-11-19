# Fairmake manufacturing agents

[Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português](README.pt-BR.md) · [Italiano](README.it.md) · [日本語](README.ja.md) · [简体中文](README.zh-Hans.md) · [한국어](README.ko.md)

Thirty small MCP agents for the back office of small and mid-size manufacturers and distributors. Each one owns **one job**, such as standard against actual cost by work order, purchase price variance, cycle count variance or retailer deductions, and cannot act outside it. They read the files you already export from NetSuite, SAP Business One, Epicor, Infor, Acumatica, Fishbowl, JobBOSS, Katana, MRPeasy, QuickBooks Enterprise, your MES, CMMS or QMS, and EDI 850, 810 and 856 files; write their reports on your computer; and wait for one named person before anything that moves money, sends a message or changes a live system.

Part of Fair Agents by Mythos Machines. MIT licence · Node 20 or newer · local files only · no credentials · no runtime dependencies. The software is free; the paid part is a fixed-price setup on your own files.

## Try one

```bash
npx -y fairmake-cost-variance demo         # standard against actual cost by work order, fictional data
npx -y fairmake-retailer-deductions demo   # retailer deductions checked against your shipment records
```

Every agent has a `demo` on fictional files, an `eval` with its own test cases and an MCP server (`npx -y <agent> mcp --root <folder>`) for Claude Desktop, Claude Code, Cursor and other MCP hosts.

## The agents

**Cost and margin (7):** `fairmake-cost-variance` (standard against actual cost by work order), `fairmake-purchase-price-variance` (receipt prices against standard cost), `fairmake-bom-cost-rollup` (assemblies costed from the BOM and latest prices), `fairmake-overhead-absorption` (overhead applied against overhead spent), `fairmake-wip-aging` (work in process by age, stale and closed orders holding WIP), `fairmake-job-margins` (quoted against actual job margin), `fairmake-landed-cost` (freight-in, duty and brokerage against allocated landed cost).

**Production and engineering (6):** `fairmake-bom-routing-gaps` (BOM and routing completeness), `fairmake-scrap-yield` (scrap against standard), `fairmake-labor-efficiency` (earned against clocked hours by work center), `fairmake-machine-downtime` (availability, MTTR and MTBF from MES exports), `fairmake-capacity-load` (weekly load against available hours), `fairmake-preventive-maintenance` (PM tasks due and overdue).

**Inventory and traceability (5):** `fairmake-cycle-counts` (count variance by ABC class), `fairmake-obsolete-inventory` (slow-moving, obsolete and excess stock with a reserve proposal), `fairmake-shelf-life` (expiry, short-dated shipments, first-expired-first-out), `fairmake-reorder-points` (safety stock and reorder points), `fairmake-lot-traceability` (breaks in the lot chain from receipt to shipment).

**Purchasing and suppliers (4):** `fairmake-late-purchase-orders` (open PO lines late, unconfirmed or at risk), `fairmake-supplier-scorecards` (on-time, rejects and price per supplier), `fairmake-rebate-claims` (rebate tiers and agreed prices), `fairmake-material-certs` (mill test reports and certificates against your specs).

**Customers, EDI and retail compliance (4):** `fairmake-order-backlog` (open orders and promise dates), `fairmake-retailer-deductions` (deductions and chargebacks against your records), `fairmake-edi-asn-errors` (ship notices against orders and shipments), `fairmake-edi-invoice-check` (invoices against customer orders).

**Quality, safety and trade (4):** `fairmake-calibration-due` (gauges due and suspect work orders), `fairmake-ncr-capa-aging` (nonconformances and corrective actions), `fairmake-osha-300-log` (injury and illness log completeness), `fairmake-hts-codes` (tariff code and origin consistency).

Freight bills, carrier invoices and parcel audits are covered by Fairhaul; the goods three-way match (PO, receipt, invoice) is covered by Fairbooks. Fairmake does not repeat them.

## How they stay safe

- **One job each.** Every agent has its own tool allowlist; any other tool name, including ones a model invents, is blocked.
- **Nothing binding happens on its own.** No agent posts to the ERP, pays, ships, changes a standard, a reorder point or a schedule, releases a hold, transmits EDI, files with an agency or sends a message. Those actions are refused outright or wait for one named person's click, even in Auto mode. Drafts are written to a file marked DRAFT; approving one records the decision, and a person acts on it.
- **Personal data is masked.** Employee, estimator and NCR or CAPA owner names, and job titles in the injury log, are replaced with tokens such as `A.R.#3f9a2c` in everything returned to the AI model. Supplier and customer names, amounts, dates and free-text fields such as stop reasons are sent as they are (details in [docs/model-view-2026-11-19.md](docs/model-view-2026-11-19.md)). The report and draft files written on your computer keep the real values, so keep them in a private folder.
- **Local files only.** No network calls, no telemetry, no credentials. Every call goes to a hash-chained audit log under `.fairmake/`.
- **Your rules, not ours.** Tolerances, targets, dispute windows, fines, specs, code lists and day caps are settings in your own file. The defaults are working examples; the result always says which settings it used.

## Use with Claude Code

```bash
claude mcp add fairmake-cost-variance -- npx -y fairmake-cost-variance mcp --root .
```

or add this repository as a plugin marketplace and install the agents you want (`.claude-plugin/marketplace.json`).

## Develop

```bash
npm install
npm test                      # every package (core and 30 agents)
npm run evals                 # every agent's private eval cases
npm run hostile               # planted formulas, HTML, path tricks and AI-directed text
npm run hostile:args          # broken arguments to every tool
npm run bench                 # 1,000 and 10,000 rows per input file
npm run intl                  # every spreadsheet eval case as a German, French, Spanish, Brazilian, Italian, Japanese, Chinese and Korean export
npm run masking               # no employee or owner name reaches the model
npm run release:check:offline # metadata, honest copy, secrets, one-click policy, npm pack
node scripts/new-agent.mjs fairmake-<job words> "<description>" kw1,kw2 <logic-module>   # scaffold a new agent
```

## How they are tested

See [REVIEW-ver1.md](REVIEW-ver1.md) for every check with its numbers. In short: 795 tests (22 or more per agent) and 609 eval cases (20 or more per agent) pass on Windows with Node 24; the hostile data and argument passes find nothing; every agent reads its demo files in eight other languages and encodings with the same result; the bench runs every agent at 10,000 rows per file; on the fictional fixtures 230 of 230 planted problems are found with no findings on the clean set.

## Limits

- The column layouts of named exports were written from knowledge of those systems and not checked against vendor documentation or a customer's live account; one, OSHA's published injury case data, was tested on the public 2024 file. `inspect` shows how a file was read; `fairmake-sources.json` names columns by hand. Accuracy on the fictional fixtures and the public-data results: [docs/accuracy-2026-11-19.md](docs/accuracy-2026-11-19.md), [docs/realdata-2026-11-19.md](docs/realdata-2026-11-19.md).
- X12 850, 810 and 856 element positions follow the public 004010 structure as recalled; trading partners differ.
- Tolerances, retailer fines and dispute windows, material specs, tariff codes and injury-log day caps are settings you supply. The agents compare your records; they do not know any customer's, agency's or standard's current rules.
- Not legal, tax, customs, safety or accounting advice. A person decides what to change, post, send or pay.
- The translations of these READMEs and of the report pages were written by Claude and have not been reviewed by native speakers.

## License

MIT © 2026 Kurt Francisco
