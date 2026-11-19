# fairmake-bom-cost-rollup

Every assembly's cost rebuilt from its bill of materials and latest purchase prices, against its standard cost, with missing and stale prices and BOM loops. Loads nothing.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

Rebuild each assembly's cost from its bill of materials (quantity per, scrap %) and the latest purchase price of every bought component, plus its own conversion cost, and compare with the standard. Flags cost moved up past the threshold, lists components with no price, prices older than the stale limit and loops in the structure.

| Finding | Example from the fictional demo data |
|---|---|
| `circular_bom` | The bill of materials loops: LOOP-A > LOOP-B > LOOP-A. Fix the structure before trusting any roll-up that uses it. |
| `cost_up` | HSG-300 rolls up to 111 on today's prices against a standard of 95 (16.8% up, 16 a unit). |
| `missing_price` | No purchase price and no bill of materials for STEM-5; the roll-up leaves them at zero. |
| `no_standard` | KIT-9 has no standard cost; the roll-up gives 6. |
| `stale_price` | Price older than 365 days used for PLT-A36 (2025-06-01). |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `note` | `` | Free text for your own records |
| `change_pct` | `5` | A rolled-up cost this far above (or below) the standard is flagged (or listed to watch) |
| `stale_days` | `365` | A purchase price older than this many days is listed as stale |

<!-- generated:start -->

## A demo run

`npx -y fairmake-bom-cost-rollup demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake BOM Cost Rollup demo: six fictional assemblies and their components, prices as of 2026-11-18. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  8 assembly(ies) rolled up as of 2026-11-18, 5 complete: 4 up past the threshold, 2 to review, 1 to watch, 1 in line with standard.
    watch        BRKT-7                          stale_price
    flag         HSG-300                         cost_up
    flag         IMP-200                         cost_up
    review       KIT-9                           no_standard
    flag         LOOP-A                          circular_bom
    flag         LOOP-B                          circular_bom
    review       VALVE-50                        missing_price

▶ Explain PUMP-100
  status: executed  decision: allow
  PUMP-100: ok. Nothing to report.

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  BOM cost roll-up written: 8 assembly(ies) rolled up as of 2026-11-18, 5 complete: 4 up past the threshold, 2 to review, 1 to watch, 1 in line with standard.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  standard update proposal drafted with 1 open marker(s) ([TO CONFIRM cost accountant who loads standards]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: production_deploy stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  standard update proposal approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries erp_update_item_master itself
  status: blocked  decision: block
  reason: Never changes standard costs, BOMs or items in the ERP.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `rollup_check` | Rebuild each assembly's cost from its bill of materials (quantity per, scrap %) and the latest purchase price of every bought component, plus its own conversion cost, and compare with the standard. | runs |
| `rollup_explain` | Show one assembly's figures and findings, from the same files as rollup_check. | runs |
| `rollup_write_report` | Write bom-cost-rollup.csv (one row per assembly, with a blank decision column for people to fill in) and bom-cost-rollup.html into out_dir (default fairmake-out/rollup). | runs |
| `rollup_draft_standard_update` | Write drafts/standard_update-proposal.md: the proposed standard for every assembly whose complete roll-up moved past the threshold. | asks first (Auto can be opted in) |
| `rollup_request_apply` | After one named human click (even in Auto), record that the reviewed standard update draft is approved in standard_update-requests.csv. | one named click, even in Auto (`production_deploy`) |
| `erp_update_item_master` | Never changes standard costs, BOMs or items in the ERP. | refused |
| `erp_post_revaluation` | Never posts an inventory revaluation. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Bill of materials (`bom`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `parent` (required) | text | Parent, Parent Item, Assembly, Product, Parent Part, BOM Item | Baugruppe, Article parent, 親品目, 父项 |
| `component` (required) | text | Component, Component Item, Child, Part, Material, Ingredient | Komponente, Composant, 子品目, 子项 |
| `qty_per` | number | Qty Per, Quantity Per, Qty, Quantity, Usage | Menge je, Quantité par, 員数, 单位用量 |
| `scrap_pct` | number | Scrap %, Scrap Pct, Scrap Percent, Scrap Factor | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| Katana | Recipes (bill of materials) export | Product variant code, Ingredient variant code, Quantity | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Purchase prices (`prices`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `item` (required) | text | Item, Part, Part Number, Item No., SKU, Component | Artikel, Article, 品目, 物料 |
| `price` | amount | Price, Last Price, Unit Price, Last Purchase Price, Purchase Price, Cost | Preis, Prix, 価格, 价格 |
| `price_date` | date | Price Date, Date, Last Purchase Date, Receipt Date, Effective Date | - |

### Item master (`items`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `item` (required) | text | Item, Part, Part Number, Item No., SKU | Artikel, Article, 品目, 物料 |
| `std_cost` | amount | Std Cost, Standard Cost, Standard, Current Cost | Standardpreis, Coût standard, 標準原価, 标准成本 |
| `conversion_cost` | amount | Conversion Cost, Labor and Overhead, Labor Overhead, Routing Cost | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-bom-cost-rollup inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-bom-cost-rollup demo
npx -y fairmake-bom-cost-rollup mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-bom-cost-rollup": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-bom-cost-rollup",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-bom-cost-rollup -- npx -y fairmake-bom-cost-rollup mcp --root .`, or install the `fairmake-bom-cost-rollup` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-bom-cost-rollup approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-bom-cost-rollup approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-bom-cost-rollup kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-bom-cost-rollup tools                 # every tool, its policy and arguments
fairmake-bom-cost-rollup sources               # the columns each input is read from
fairmake-bom-cost-rollup inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-bom-cost-rollup call rollup_check '{"bom":"<bom>","prices":"<prices>","items":"<items>"}'
fairmake-bom-cost-rollup eval                  # the private eval cases on the fictional fixtures
fairmake-bom-cost-rollup demo
```

## Audit log and data

Every call is written to `.fairmake/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Reads only the files you give it. It does not log in to an ERP, MES, CMMS, QMS, EDI network, bank, supplier or customer portal, and changes nothing in them.
- Thresholds and rules are settings in your own file, with working defaults listed in the result as settings_used. They are not a costing, quality or safety standard; check them against your own policies and contracts.
- Not legal, tax, customs, safety or accounting advice. A person decides what to change, post, send or pay.
- Column names for the named exports were written from knowledge of those systems and not checked against a live account; `inspect` shows how a file was read and `fairmake-sources.json` names columns by hand.
- The bundled fixtures are fictional. Version 0.1.0; nothing has been published yet.
