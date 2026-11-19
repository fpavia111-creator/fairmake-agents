# fairmake-scrap-yield

Scrap rates against standard by work order with the cost of the excess, missing reasons and counts that do not add up, by work center and reason. Posts no scrap.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

Compare each work order's scrap rate with its item's standard (or the default). Flags scrap above the standard times the alert factor with the cost of the excess; reviews scrap with no reason, good plus scrap not equal to started and yield over 100%. Totals by work center and reason.

| Finding | Example from the fictional demo data |
|---|---|
| `no_reason` | WO-4003 scrapped 14 with no reason recorded. |
| `qty_mismatch` | WO-4004: 290 good plus 6 scrap is 296, not the 300 started. 4 unaccounted for. |
| `scrap_over_standard` | WO-4002 scrapped 18 of 100 (18%) against a 5% standard: 13 more than standard, 585 at 45 each. |
| `yield_over_100` | WO-4006 reports 81 good from 80 started. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `note` | `` | Free text for your own records |
| `default_scrap_pct` | `3` | Standard scrap % for items with no standard |
| `alert_factor` | `1.5` | Scrap above the standard times this factor is flagged |
| `min_amount` | `50` | Excess scrap worth less than this is not flagged |

<!-- generated:start -->

## A demo run

`npx -y fairmake-scrap-yield demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Scrap Yield demo: ten fictional work orders on four work centers. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  10 work order(s), 3050 started, 137 scrapped (4.5%, 1826): 841 above standard on 3 order(s), 2 to review, 5 within standard.
    flag         WO-4002                         scrap_over_standard
    flag         WO-4003                         scrap_over_standard, no_reason
    review       WO-4004                         qty_mismatch
    review       WO-4006                         yield_over_100
    flag         WO-4008                         scrap_over_standard

▶ Explain WO-4002
  status: executed  decision: allow
  WO-4002: flag. WO-4002 scrapped 18 of 100 (18%) against a 5% standard: 13 more than standard, 585 at 45 each.

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Scrap and yield written: 10 work order(s), 3050 started, 137 scrapped (4.5%, 1826): 841 above standard on 3 order(s), 2 to review, 5 within standard.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  scrap review open drafted for 841 with 1 open marker(s) ([TO CONFIRM quality manager]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  scrap review open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries erp_post_scrap itself
  status: blocked  decision: block
  reason: Never posts scrap transactions or inventory write-offs.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `scrap_check` | Compare each work order's scrap rate with its item's standard (or the default). | runs |
| `scrap_explain` | Show one work order's figures and findings, from the same files as scrap_check. | runs |
| `scrap_write_report` | Write scrap-yield.csv (one row per work order, with a blank decision column for people to fill in) and scrap-yield.html into out_dir (default fairmake-out/scrap). | runs |
| `scrap_draft_scrap_review` | Write drafts/scrap_review-open.md: the work orders with scrap above standard or with missing reasons, for the quality manager to give causes and actions. | asks first (Auto can be opted in) |
| `scrap_request_send` | After one named human click (even in Auto), record that the reviewed scrap review draft is approved in scrap_review-requests.csv. | one named click, even in Auto (`binding_send`) |
| `erp_post_scrap` | Never posts scrap transactions or inventory write-offs. | refused |
| `mes_change_setpoint` | Never changes machine settings, recipes or MES configuration. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Production counts (`production`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `work_order` (required) | text | Work Order, WO, Job, Production Order, MO number | Fertigungsauftrag, Ordre de fabrication, 製造指図, 生产工单 |
| `item` | text | Item, Part, Part Number, Product | Artikel, Article, 品目, 物料 |
| `work_center` | text | Work Center, Machine, Line, Resource, Cell | Arbeitsplatz, Poste de charge, 作業区, 工作中心 |
| `prod_date` | date | Date, Production Date, Shift Date, Completed | - |
| `qty_started` | number | Qty Started, Started, Input Qty, Qty Issued | Gestartete Menge, Quantité lancée, 投入数, 投入数量 |
| `qty_good` | number | Qty Good, Good, Good Count, Good Qty, Qty Completed | Gutmenge, Quantité bonne, 良品数, 合格数量 |
| `qty_scrap` | number | Qty Scrap, Scrap, Scrap Qty, Reject Count, Rejected | Ausschussmenge, Quantité rebutée, 仕損数, 报废数量 |
| `unit_cost` | amount | Unit Cost, Std Cost, Standard Cost, Cost | Stückkosten, Coût unitaire, 単価, 单位成本 |
| `scrap_reason` | text | Scrap Reason, Reason, Reject Reason, Top Reject Reason, Defect | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| MES (generic) | Production counts by work order | Work Order, Machine, Good Count, Reject Count | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Standard scrap rates (`standards`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `item` (required) | text | Item, Part, Part Number, Product | Artikel, Article, 品目, 物料 |
| `std_scrap_pct` | number | Std Scrap %, Standard Scrap %, Scrap Factor, Planned Scrap %, Scrap % | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-scrap-yield inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-scrap-yield demo
npx -y fairmake-scrap-yield mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-scrap-yield": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-scrap-yield",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-scrap-yield -- npx -y fairmake-scrap-yield mcp --root .`, or install the `fairmake-scrap-yield` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-scrap-yield approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-scrap-yield approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-scrap-yield kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-scrap-yield tools                 # every tool, its policy and arguments
fairmake-scrap-yield sources               # the columns each input is read from
fairmake-scrap-yield inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-scrap-yield call scrap_check '{"production":"<production>"}'
fairmake-scrap-yield eval                  # the private eval cases on the fictional fixtures
fairmake-scrap-yield demo
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
