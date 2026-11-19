# Fairmake ver 1: review

18 Nov 2026. What was built, how it was checked, what was found and fixed, what is not checked yet, and every decision made without Kurt's input (he asked for the suite to be built today without it).

## Scope

Fairmake is the Fair Agents product for small and mid-size manufacturers and distributors: `fairmake-core` plus **30 agents**, each with one job, reading files plants already export. Version 0.1.0 of everything; nothing published, pushed or uploaded.

| Group | Agents |
|---|---|
| Cost and margin (7) | cost-variance, purchase-price-variance, bom-cost-rollup, overhead-absorption, wip-aging, job-margins, landed-cost |
| Production and engineering (6) | bom-routing-gaps, scrap-yield, labor-efficiency, machine-downtime, capacity-load, preventive-maintenance |
| Inventory and traceability (5) | cycle-counts, obsolete-inventory, shelf-life, reorder-points, lot-traceability |
| Purchasing and suppliers (4) | late-purchase-orders, supplier-scorecards, rebate-claims, material-certs |
| Customers, EDI and retail compliance (4) | order-backlog, retailer-deductions, edi-asn-errors, edi-invoice-check |
| Quality, safety and trade (4) | calibration-due, ncr-capa-aging, osha-300-log, hts-codes |

Every package is `fairmake-<job>`; the table drops the prefix.

## Checks run, and results

Windows 10, Node 24.20.0, this machine.

| Check | Result |
|---|---|
| `npm test` (every workspace) | **794 tests, 794 pass**: 134 in fairmake-core, 22 in each of the 30 agents (11 contract, 4 shared, 7 domain) |
| `npm run evals` | **608 eval cases, all pass**; 20 to 21 per agent (6 to 8 written by hand, 11 to 12 generated safety and policy cases, 2 German and Japanese copies of the first case) |
| `npm run hostile` (formulas, HTML, `../` ids and AI-directed text planted in every fixture; every eval case; sample exports) | 30 agents, 3,100 calls, 1,384 planted values, **0 findings** (161 results correctly flagged for instruction-like text) |
| `npm run hostile:args` (null, numbers, arrays, 200,000-character strings, NUL, `../` and absolute paths in every argument of every tool) | 30 agents, **14,860 calls, 0 findings** |
| `npm run intl` (every spreadsheet eval case rewritten as a German, French, Spanish, Brazilian, Italian, Japanese, Chinese and Korean export: local column names, encodings, `1.234,56`, local dates) | 30 agents, 388 cases with spreadsheet inputs, 8 languages: **every case that passes in English passes in every language** (3,104 runs). 323 of 489 column names are translated (German count). The other 166 have no translation in the core yet, so they stay in English in the test files; an export that names those columns in another language needs a column map at setup (`inspect` shows which). The 9 cases marked `english_layout` are skipped (see below) |
| `npm run masking` (personal values planted as canaries, every eval case) | 4 agents with personal fields (job-margins, labor-efficiency, ncr-capa-aging, osha-300-log), 19 fictional names planted as canaries, 80 calls, **0 leaks** |
| `npm run bench` (1,000 and 10,000 rows per input file, every read and report tool) | 90 tools across 30 agents, each call in its own process, **0 need attention**. At 10,000 rows the slowest call is `wip_write_report` (1.7 s), then `rollup_check` (1.3 s; growth 17.5 times from 1,000 rows, because a BOM rollup walks levels) and `certs_write_report` (1.2 s); the most memory is 203 MB (`landed_cost_write_report`). Record in `docs/bench-2026-11-18.md` (i7-9700K, 48 GB) |
| `npm run release:check:offline` | **Dry run passed, nothing published.** 31 packages listed; metadata in order; secret scan of 1,010 tracked files clean; honest-copy scan of 94 README, package and manifest files clean; 7 one-click categories present and none set to allow; no tool marked paid; tests 794 and evals 608/608 again; hostile data pass 0 findings; `npm pack` 31 packages, 569 KB in total, with no tests, state, output or keys. The one warning was these two uncommitted files (this review and the bench record), committed straight after; npm names skipped as offline (checked separately, above) |
| `readme:check`, `plugin:check`, `evals:make --check`, `intl:fixtures --check` | all current |
| `npm view <name>` for all 31 names (read-only) | all free; record in `docs/npm-names-2026-11-18.md` |
| MCP Registry step (`node ..\add-mcp-registry.cjs fairmake-agents fairmake.html`) | `mcpName` and `server.json` for all 30 agents; titles keep acronyms upper case (WIP, BOM, NCR, CAPA, OSHA, HTS, EDI, ASN) |
| Demos | every agent's `demo` runs: check, explain, report, draft in Auto, the one-click request waiting, a named approval, a refused tool |

## Found and fixed during the build

**Shared core (the same code is in the Lodestar core and every family copied from it; notes for the other sessions are in the shared notes folder):**
- A header that is a field's own name in another letter case ("Item" for `item`, "ID" for `id`) was not re-keyed when nothing else in the file needed mapping, so the agent read the column as blank. Fixed in `sources.js`; test added.
- A file whose headers are already the agent's own names was returned untouched even when its dates and amounts were written the local way. A German completions file with `12.11.2026` was read as 11 December. Such files are now read through the adapter. Found by the German eval case of preventive-maintenance; one Lodestar core test that documented the old behaviour was updated and a German case added.
- Report tools returned absolute host paths to the model; they now return paths relative to `--root` with `/`, as the brief asks.
- Ported from the Fairtable session: paths over 1,024 characters refused before any file call; a GBK header that is valid UTF-8 by accident read as GBK; underscore tool prefixes allowed.

**Agents:**
- purchase-price-variance: a receipt priced at 6.00 against a 0.05 standard (a unit-of-measure slip) also produced a "price jump" of 23,760. Slips are no longer compared with earlier prices, and the slip price does not become the next comparison point.
- edi-asn-errors: an ASN for a PO with no shipment record was called late by comparing its send time with midnight of a date-only ship date. Lateness is now measured only against a time.
- obsolete-inventory: the item count and the item list shared one key, so the summary printed `[object Object]`; QuickBooks group headings and "Total ..." rows were read as items (the Total row only surfaced when the contract test reversed the column order). Fixed.
- machine-downtime: plant availability counted downtime on machines with no scheduled hours. Now only scheduled machines count.

## Not checked yet (say this out loud)

- **Real exports.** Every named layout (Epicor job cost, NetSuite work orders and sales orders, SAP Business One goods receipts and open POs, Acumatica receipts and stock items, Fishbowl counts and lots, JobBOSS, Katana, MRPeasy, QuickBooks Enterprise, Infor CSI operations, MES, CMMS, QMS, EHS and EDI provider reports) was written from knowledge of the product and was not compared with vendor documentation or a live account. The first setup confirms each with `inspect`.
- **X12.** 850, 810 and 856 element positions follow the public 004010 structure as recalled, not the licensed implementation guides; trading partners differ.
- **Named layouts in other languages.** Nine eval cases read a named export whose row id is built from several English column labels (for example Fishbowl part and location). A copy with every header translated is a different file and is not recognised as that layout, so these cases are marked `english_layout` and skipped by the language check. Translated column names still work for every other case.
- **Rules.** Tolerances, aging buckets, scrap standards, retailer fines and dispute windows, material specs, tariff code lists, the OSHA day cap and late-entry window are settings with working defaults. A cost accountant, quality manager, trade compliance lead, safety professional and customs broker should look at the defaults before a customer relies on them. The OSHA agent checks data completeness only and never decides recordability; the HTS agent never classifies goods.
- **Node 20 and 22**, macOS and Linux: only Node 24 on Windows was run here.
- **`npm run mcp:check`** (needs the MCP SDK installed) was not run; the stdio smoke test in every agent's shared tests passed.
- **Translations** of the root README and report pages were written by Claude and have not been reviewed by native speakers.
- No customer, controller, quality manager or lawyer has reviewed the agents or the sales copy.

## Decisions made (Kurt asked for none to wait for him)

- **Names.** Brief naming rule: `fairmake-<what it does>`, tool prefixes are short job words (`cost_variance`, `ppv`, `rollup`, `bom_gaps`, `open_po`, `osha_log`...). No themed names were ever used, so nothing needed renaming. Core `fairmake-core`.
- **Which 30.** Every example in the brief became an agent, plus customer invoices against customer POs (the brief lists EDI 810 files as an input) and material certificates on receipts. Not repeated from other families: freight bills and carrier invoices (Fairhaul) and the goods three-way match (Fairbooks `ananke-of-match`); landed-cost checks freight-in, duty and brokerage against what was allocated into item cost only.
- **Ideas left for ver 2:** outside processing (material at subcontractors), engineering changes against open work orders, consignment stock.
- **One factory.** All 30 agents are built by `defineFairmakeAgent` in the core (same tool shape, policy, masking, settings and reports), with each agent's logic in its own pure module. This kept the 30 consistent and testable within the day.
- **Statuses.** Every item gets `flag` (act on it), `review` (data missing or unclear), `watch` (worth knowing) or `ok`, the same words as Fairtable.
- **One-click categories.** Messages to suppliers, customers and internal teams are `binding_send`; changes to ERP master data (standards, rates, reorder points, BOMs) are `production_deploy`; journals, adjustments, reserves and landed cost postings are `move_money`. Each agent also lists two refused tools nearest its job (posting, paying, transmitting EDI, filing with an agency, editing records).
- **Masking.** Fields holding people's names are marked `personal` (estimator, employee, operator, NCR and CAPA owner, injury case employee) and masked in everything returned to the model. Results talk about work centers, not people (labor efficiency).
- **Money in findings.** A finding's amount is the money it puts at stake (variance, excess scrap cost, overpayment, fines from your guide); findings that are about data carry no amount.
- **Prices** (sales/pricing-page-ver1.md): packs $2,000 to $3,000, whole plant $9,500, multi-plant $13,500, partner rollout $15,000; support $200 to $1,200 a month. In line with the other families; the retail and EDI pack costs more because each trading partner guide must be mapped.

## Files

- `REVIEW-ver1.md` (this file), `sales/pricing-page-ver1.md`, `sales/site.json`
- `sample-reports/`: every agent's HTML report and CSV worklist on its fictional demo files, in English, with `index.html`
- `docs/npm-names-2026-11-18.md`; `fairmake-out/` holds the raw check outputs (not committed)
