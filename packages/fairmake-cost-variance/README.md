# Fairmake Cost Variance

`fairmake-cost-variance` · MCP server and CLI · MIT

Standard against actual cost by work order (material, labor, overhead), with a variance review draft for the production manager. Posts nothing.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

Compare standard and actual cost on every work order by element (material, labor, overhead). Flags elements over both the percentage and the amount tolerance, reviews large favorable variances and work orders with no standard, and flags work orders closed with cost and no output. Returns totals by element and by finding.

| Finding | Example from the fictional demo data |
|---|---|
| `cost_no_output` | WO-1006 is closed with 1800 charged and nothing completed. Find where the output went, or move the cost. |
| `labor_over` | Labor 1400 against standard 800: 600 over (75%). |
| `large_favorable` | Total cost 3050 is 950 (23.8%) under standard 4000. Check the standard, and whether every material issue and labor ticket was charged to the work order. |
| `material_over` | Material 2600 against standard 2000: 600 over (30%). |
| `no_standard` | WO-1005 has 450 actual cost and no standard cost on file. Set a standard before judging the variance. |
| `overhead_over` | Overhead 700 against standard 400: 300 over (75%). |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `tolerance_pct` | `5` | An element is flagged over when its variance is above this percentage of standard |
| `tolerance_amount` | `250` | and above this amount (both must be exceeded) |
| `favorable_pct` | `15` | A cost this far under standard (and above the amount) is sent for review: the standard may be loose or costs may be missing |

<!-- generated:start -->

## A demo run

`npx -y fairmake-cost-variance demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Cost Variance demo: ten fictional work orders at a fictional machine shop. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  10 work order(s): standard 29500, actual 31630, variance 2130. 4 over tolerance (1850), 2 to review, 4 within tolerance.
    flag         WO-1002                         material_over
    flag         WO-1003                         labor_over, overhead_over
    review       WO-1004                         large_favorable
    review       WO-1005                         no_standard
    flag         WO-1006                         cost_no_output
    flag         WO-1010                         labor_over

▶ Explain WO-1003
  status: executed  decision: allow
  WO-1003 (HSG-300): standard 2700, actual 3620, variance 920. material 1520 vs 1500; labor 1400 vs 800; overhead 700 vs 400. Labor 1400 against standard 800: 600 over (75%). Overhead 700 against standard 400: 300 over (75%).

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Standard against actual cost by work order written: 10 work order(s): standard 29500, actual 31630, variance 2130. 4 over tolerance (1850), 2 to review, 4 within tolerance.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  variance review open drafted for 1850 with 1 open marker(s) ([TO CONFIRM production manager or plant controller]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  variance review open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries erp_post_journal itself
  status: blocked  decision: block
  reason: Never posts variance journals, closes work orders or changes the books in the ERP; your accountant does that.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `cost_variance_check` | Compare standard and actual cost on every work order by element (material, labor, overhead). | runs |
| `cost_variance_explain` | Show one work order's figures and findings, from the same files as cost_variance_check. | runs |
| `cost_variance_write_report` | Write cost-variance.csv (one row per work order, with a blank decision column for people to fill in) and cost-variance.html into out_dir (default fairmake-out/cost-variance). | runs |
| `cost_variance_draft_variance_review` | Write drafts/variance_review-<id>.md: every work order over tolerance or needing a look, with the element, amount and reason, addressed to the production manager. | asks first (Auto can be opted in) |
| `cost_variance_request_send` | After one named human click (even in Auto), record that the reviewed variance review draft is approved in variance_review-requests.csv. | one named click, even in Auto (`binding_send`) |
| `erp_post_journal` | Never posts variance journals, closes work orders or changes the books in the ERP; your accountant does that. | refused |
| `erp_update_standard_cost` | Never changes standard costs in the item master. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Work order costs (`work_orders`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `work_order` (required) | text | Work Order, WO, WO Number, Job, Job Number, Production Order | Fertigungsauftrag, Ordre de fabrication, 製造指図, 生产工单 |
| `item` | text | Item, Part, Part Number, Assembly, Product, Item No. | Artikel, Article, 品目, 物料 |
| `wo_status` | text | Status, Job Status, WO Status, Order Status | - |
| `closed_date` | date | Closed Date, Close Date, Completed Date, Date Closed | - |
| `qty_completed` | number | Qty Completed, Quantity Completed, Completed Qty, Built, Qty Built | Gefertigte Menge, Quantité produite, 完成数, 完工数量 |
| `std_material` | amount | Std Material, Standard Material, Est Mtl Cost, Estimated Material Cost, Planned Material Cost | - |
| `act_material` | amount | Act Material, Actual Material, Act Mtl Cost, Actual Material Cost | - |
| `std_labor` | amount | Std Labor, Standard Labor, Est Lbr Cost, Estimated Labor Cost, Planned Labor Cost | - |
| `act_labor` | amount | Act Labor, Actual Labor, Act Lbr Cost, Actual Labor Cost | - |
| `std_overhead` | amount | Std Overhead, Standard Overhead, Est Burden Cost, Estimated Burden, Planned Overhead | - |
| `act_overhead` | amount | Act Overhead, Actual Overhead, Act Burden Cost, Actual Burden | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| Epicor Kinetic | Job cost summary (BAQ export, one row per job) | Job, Part, Est Mtl Cost, Act Mtl Cost | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-cost-variance inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-cost-variance demo
npx -y fairmake-cost-variance mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-cost-variance": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-cost-variance",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-cost-variance -- npx -y fairmake-cost-variance mcp --root .`, or install the `fairmake-cost-variance` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-cost-variance approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-cost-variance approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-cost-variance kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-cost-variance tools                 # every tool, its policy and arguments
fairmake-cost-variance sources               # the columns each input is read from
fairmake-cost-variance inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-cost-variance call cost_variance_check '{"work_orders":"<work_orders>"}'
fairmake-cost-variance eval                  # the private eval cases on the fictional fixtures
fairmake-cost-variance demo
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
