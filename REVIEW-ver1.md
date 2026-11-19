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

- `REVIEW-ver1.md` (this file), `sales/pricing-page-ver1.md`, `sales/site.json`, `sales/final-pass.json`
- `sample-reports/`: every agent's HTML report and CSV worklist on its fictional demo files, in English, with `index.html`
- `docs/npm-names-2026-11-18.md`, `docs/bench-2026-11-18.md`, `docs/accuracy-2026-11-19.md`, `docs/model-view-2026-11-19.md`, `docs/realdata-2026-11-19.md` (each `.md` has a `.json` beside it where the script writes one); `fairmake-out/` holds the raw check outputs (not committed)

## Final pass (19 Nov 2026)

Run at the main session's request, following the brief's "Final pass" checklist and Kurt's five review questions, then public data. Everything below was measured on this machine (Windows 10, Node 24.20.0); the full bar was run again from a fresh `git clone` of this folder with `npm install --offline`.

### Final numbers

From a fresh clone at commit 5e1a97e, `npm install --offline` (no network), Windows 10, Node 24.20.0. Raw outputs in `fairmake-out/checks/final-pass/` (not committed).

| Check | Result |
|---|---|
| `try_it` (the four commands in `sales/final-pass.json`, offline) | demo runs with no setup: check, explain, report, draft, one-click request, refused tool |
| `npm test` | **795 tests, 795 pass** (134 core, 23 injury log, 22 in each other agent) |
| `npm run evals` | **609 eval cases, all pass** (20 to 21 per agent) |
| `npm run accuracy` | **230/230 planted found, 0 unplanned; 0 findings on 440 clean rows (29 agents); 84/84 mutations caught** |
| `npm run masking` | 4 agents, 26 fictional names and job titles planted, 81 calls, **0 leaks** |
| `npm run intl` | 389 cases with spreadsheet inputs × 8 languages: every case that passes in English passes in every language (326 of 502 column names translated, German count) |
| `npm run hostile` | 30 agents, 3,106 calls, **0 findings** |
| `npm run hostile:args` | 30 agents, 14,866 calls, **0 findings** |
| `npm run bench` | 90 tools at 1,000 and 10,000 rows, **0 need attention**; slowest 1.6 s (`deductions_write_report` at 10,000 rows), most memory 204 MB |
| `readme:check`, `plugin:check`, `evals:make --check`, `intl:fixtures --check` | all current in the fresh clone |
| `npm run release:check:offline` | **Dry run passed, 1 skipped** (npm names, offline). Tree clean, secret scan of 1,108 tracked files clean, honest-copy scan clean, 7 one-click categories none allowed, no paid tool, 795 tests and 609/609 evals, hostile 0, `npm pack` 31 packages, 589 KB, no stray files |
| Real data (`npm run realdata`) | OSHA 2024: 5,431 cases, 0 disagreements with the re-count; USITC tariff schedule: 19,949 lines, 0 findings |
| Clone after every check | 0 files changed |

### The eight points

1. **Names.** No themed names anywhere (`git grep` for the metal words of the first plan and for other families' names). The only mentions of Lodestar, Fairhaul and Fairtable are the core's CHANGELOG history (where the core came from) and the root README's pointer to Fairhaul for freight. One CHANGELOG line said "the Fairtable session"; it now says "the Fairtable core".
2. **Each agent read as a buyer.** Every README now has a section near the top, "What it needs, and what stays with a person", generated from the agent itself: each input file (required or optional), the tools it refuses, and that approving a draft is one click by a named person that only records the approval. Removed "nothing has been published yet" (the repository is public). The core README still carried text from the core it was copied from: "two layouts (Procore RFIs, Ramp transactions) were compared with vendor documentation" and an Okta example. Neither exists in Fairmake; both corrected.
3. **Honest copy.** Scanned READMEs (nine languages), `site.json`, the pricing page and the sample reports for compliance, certification, savings, guarantee and advice claims: none. The masking sentences on the site, pricing page and README were made exact (which names are masked, that supplier and customer names, amounts and free text go in clear). Two npm keywords, `retail-compliance` and `trade-compliance`, are topic words for search, not claims, and were kept.
4. **Binding actions.** Every agent has one draft that asks first and one request that stays one named click even in Auto (`binding_send`, `production_deploy` or `move_money`), refuses two named tools nearest its job, and blocks any other name. The release check confirms 7 one-click categories and none set to allow; every demo shows the refused tool and the click.
5. **The full bar from a clean install:** see "Final numbers". A fresh Windows clone (core.autocrlf true) turned every text file to CRLF and would have failed the byte-for-byte checks; `.gitattributes` now keeps LF (the German and Japanese test exports and the `.ics` files keep CRLF on purpose). The committed `package-lock.json` listed only 2 of the 31 workspace packages; regenerated.
6. **Fictional fixtures, masking on.** All people in the fixtures carry made-up names. The supplier "Northwind Metals" and customer "Northwind Tools" were renamed "North Example Metals" and "North Example Tools": Northwind is a well-known sample name that real businesses may also use, and every other company already carries Example, Sample or Demo. The tariff fixture uses real public tariff numbers (not entities). Masking: the injury log now masks job titles as well as names (a job title with a date and an outcome can point to one person in a small plant).
7. **site.json and samples.** 30 agents in 6 groups, the same 30 packages as the folder; prices match the pricing page; the export-layout note now says one layout was tested on a public file. Sample reports regenerated after every change (only the injury log's changed).
8. **Pack contents.** Secret scan of every tracked file, `npm pack` of 31 packages: no keys, tokens, `.npmrc`, `.fairmake` state, `fairmake-out` or tests (release check, below).

### Kurt's five questions

**1. Accuracy** (`npm run accuracy`; record in `docs/accuracy-2026-11-19.md`, per agent). For every agent the fixture notes list what was planted; the script checks the demo files find exactly those problems (recall, and anything else counts as unplanned), runs the same files with every planted problem removed (`fixtures/clean/`: any finding is a false positive), and changes one field of the clean set at a time (mutation cases, each must raise one named finding).

- Family: **230 of 230 planted problems found, 0 unplanned findings; 0 findings on 440 clean rows (29 of 30 agents); 84 of 84 mutation cases caught.**
- Per agent: planted found 4/4 to 13/13, every agent 100%; clean rows 8 to 30 per agent; 2 to 4 mutations per agent.
- No clean set for retailer-deductions: every deduction is something for a person to accept or dispute, so each gets a finding by design. Its two mutation cases run on the demo files.
- Rebates: an agreement still running reports `rebate_accruing` by design, so its clean set keeps the two running agreements below their first tier.
- The planted and clean sets were written by the same author as the rules: these numbers show the rules do what they are written to do, not how they do on a plant's real exports. On real public data (below) the injury log agreed with an independent re-count on all 5,431 cases and the tariff checks raised nothing on 19,949 real tariff lines.

**2. Security: what reaches the AI model** (`npm run model-view`; per agent table in `docs/model-view-2026-11-19.md`, measured by running each check and looking for every fixture value in the JSON the model receives).

- Masked (token such as `A.R.#3f9a2c`, same name same token): estimator (job-margins), employee (labor-efficiency), NCR and CAPA owner (ncr-capa-aging), employee and job title (osha-300-log). Masking check: 26 fictional names and job titles planted, 81 calls, 0 leaks.
- Sent in clear by every agent: amounts, quantities, dates, rates, finding codes, item, order, lot and receipt numbers. Company names in clear: supplier (purchasing, landed cost, rebates, certificates, tariffs), customer (backlog, deductions, lot shipments, job margins).
- Free text sent as typed (where a person could write a name or a health detail): gauge and asset descriptions and locations (calibration, PM), item descriptions (obsolete stock, tariffs), scrap reasons, downtime stop reasons, NCR defect codes, injury outcome. Injury descriptions, locations and root causes are read but not returned to the model.
- Results go to whatever model the user's assistant uses. For injury and illness records, staff time and prices treated as confidential, use a model covered by your own agreements or a local model. No HIPAA or other compliance claim is made anywhere.
- Hostile checks re-run in the full bar: data and export pass 3,106 calls, argument pass 14,866 calls, 0 findings.

**3. Compatibility.** 30 named export layouts plus X12 (list with status in `sales/final-pass.json`, "formats"):

- Tested on a real published file: **1** (OSHA ITA case detail data, 2024 file).
- Checked against vendor documentation: **0**.
- Tested on a customer's real export: **0**.
- Written from knowledge of the export: **29**: Epicor (2), NetSuite (4), SAP Business One (2), Acumatica (2), Infor CSI (1), Fishbowl (2), JobBOSS (3), Katana (1), MRPeasy (2), QuickBooks Enterprise (2), and generic MES (2), CMMS, QMS, calibration, EHS, EDI provider and retailer portal layouts.
- X12 850, 856, 810 and 997 are read from the public 004010 structure as recalled; no public sample file with a clear licence was used in this pass.
- Every layout also maps by column names in nine languages, and `fairmake-sources.json` maps a file by hand.

**4. Commercial traction.** Paying customers today: none. No checkout is live (main session's answer for the suite).

**5. Support: who maintains the rules.** Thresholds are the customer's settings; Mythos Machines maintains what is fixed in code. Every dated rule:

| Rule | Where it lives | Source and date | How a customer updates it |
|---|---|---|---|
| Injury log day cap 180 | `day_cap` setting, default in `packages/fairmake-osha-300-log/src/osha.js` | OSHA recordkeeping, 29 CFR 1904.7(b)(3)(vii), as of 19 Nov 2026 | settings file |
| Injury log entry window 7 days | `entry_days` setting, same file | 29 CFR 1904.29(b)(3), as of 19 Nov 2026 | settings file |
| Rates per 200,000 hours | code, same file (needs `annual_hours` setting) | OSHA incidence rate formula, as of 19 Nov 2026 | new version if the base ever changes |
| ITA outcome codes 1 to 4 | code (`ITA_OUTCOMES`), same file | OSHA ITA case detail data dictionary, 2024 file | new version |
| Tariff codes and duty rates | `codes` setting (`fairmake-hts-codes`) | the customer's own list (built from the USITC schedule or the broker's file), dated by them | settings file |
| Tariff number format (6, 8 or 10 digits) | code, `packages/fairmake-hts-codes/src/hts.js` | HTSUS structure, as of 19 Nov 2026 | new version |
| Retailer dispute windows, ASN grace, reason codes, fines | `dispute_window_days`, `default_window_days`, `asn_grace_hours`, `reason_map` (deductions) and `asn_grace_hours`, `fines` (ASN errors) | the retailer's compliance guide, entered by the customer | settings file |
| Shelf-life minimum days per customer | `customer_min_days` setting | the customer's trading partner terms | settings file |
| Material specs | specs JSON (`fairmake-material-certs`) | the customer's purchase specs; fixture values are illustrative | specs file |
| Rebate tiers and claim-by dates | agreements JSON (`fairmake-rebate-claims`) | the customer's supplier agreements | agreements file |
| X12 element positions (850, 810, 856, 997) | code, `packages/fairmake-core/src/x12.js` | public X12 004010 structure as recalled, 18 Nov 2026 | new version; CSV inputs work meanwhile |
| Named export layouts (30) | code, `packages/fairmake-core/src/exports.js` | written 18 Nov 2026 (one tested 19 Nov 2026) | `fairmake-sources.json` column map; new version |
| Column names in nine languages | code, `packages/fairmake-core/src/i18n/columns.js` | written 18 Nov 2026 | `fairmake-sources.json`; new version |

The other numbers (tolerances, aging buckets, targets, reserve percentages, look-ahead days) are not dated rules; they are the customer's choices with working defaults, printed in every result as `settings_used`. The support plan on the pricing page covers export changes, setting updates and new versions.

### Real data

Script `scripts/realdata.mjs` (`--download` fetches into the git-ignored `_realdata/`); results in `docs/realdata-2026-11-19.md` and `.json`. Public government files only, in their published format.

1. **OSHA Injury Tracking Application, Case Detail Data 2024** (https://www.osha.gov/Establishment-Specific-Injury-and-Illness-Data, downloaded 19 Nov 2026, U.S. government work, public domain).
   - What ran: the injury log agent on the 5,431 cases from 667 manufacturing establishments in Ohio (of 104,631 manufacturing and 688,649 cases nationally), read in OSHA's own layout.
   - Found: 114 cases with findings: 79 day counts over 180, 18 missing fields, 13 missing day counts, 5 outcomes that contradict the days.
   - Re-count: an independent count of every case from the form's rules gave **0 disagreements**.
   - What it showed, fixed in this pass:
     - The layout was not recognised. Added: outcome codes 1 to 4, dates like `16JAN2024` (SAS format, now read by the core), and case numbers that restart in each establishment (grouped by establishment).
     - `ALL-2024-1` and `All-2024-1`, two cases in one establishment, were merged because case numbers were compared ignoring letter case. Now compared as written.
     - Restriction days on an "other recordable" case were not flagged. Now flagged (`outcome_days_mismatch`).
     - Days over 180 were reported for review as if they were an error, but OSHA lets counting stop at 180 without requiring it. Now listed to watch: 79 of the 114 findings were these.
     - With no return dates in a file, every days-away case would have been listed as open. Open cases are now listed only when the file has return dates.
   - False positives: none against the published numbers. Whether each finding is an error on the employer's log is the employer's call.
2. **USITC Harmonized Tariff Schedule, current edition, JSON export** (https://hts.usitc.gov/, downloaded 19 Nov 2026, U.S. government work, public domain).
   - What ran: all 19,949 10-digit statistical lines as items, 17,723 entry lines at the published general duty, and a code list of 26,807 8- and 10-digit numbers (3,153 with a specific or compound duty, listed without a percentage).
   - Found: **0 findings**, so no false positives from the code format, code list or duty rate checks. Classification itself is not tested; the agent never classifies.
3. **Nothing public fits the other 28 agents**: work orders, costs, BOMs, receipts, counts, PM and calibration records, deductions and EDI files are private business records. A public FRED download of metal producer price indexes (for purchase price variance) failed from this machine and was dropped.

### What changed in this pass (all committed)

- Accuracy measurement: `scripts/accuracy.mjs`, `scripts/accuracy-specs.mjs`, `fixtures/clean/` in 29 agents.
- `scripts/model-view.mjs`: what reaches the model, per agent.
- `scripts/realdata.mjs`: the two public files.
- Injury log:
  - reads OSHA's ITA layout;
  - masks job titles;
  - compares case numbers as written and reviews repeated ones;
  - flags restriction days on an other-recordable case;
  - lists day counts over the cap to watch, not for review;
  - lists open cases only when the file has return dates.
  - Tests 22 to 23, evals 20 to 21.
- Core:
  - reads `16JAN2024` and `20JAN2025:16:52:00` dates;
  - layouts can be marked "tested on a published file";
  - README text inherited from another core corrected.
- READMEs: a "What it needs, and what stays with a person" section in all 30.
- Fixtures: Northwind renamed to North Example.
- Site files: `site.json`, pricing page and root README say exactly what is masked and how layouts were checked.
- Repository: `.gitattributes`, the lockfile, and `_realdata/` git-ignored.

### For Kurt to decide

- **Format labels on the site.** `final-pass.json` says "written from knowledge of the export; not yet checked against documentation or a real export" for 29 layouts. The brief's shape offers only "written from documentation", which would claim a check that was not done. Most other families used that shorter label: pick one wording for the suite.
- **First real exports.** Which systems to confirm first with a design partner. NetSuite, Epicor, SAP Business One and the retailer remittance and EDI provider reports carry the most agents.
- **Rules review.** A safety professional for the injury log defaults, and a customs broker for the tariff checks, before a customer relies on them.
