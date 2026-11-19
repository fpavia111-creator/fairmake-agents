# Fairmake WIP Aging

`fairmake-wip-aging` · MCP server and CLI · MIT

Open work orders aged by days since release, stale and past-due orders, and closed orders still holding WIP. Closes nothing.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

Age every work order by days since release and bucket the WIP. Flags open orders holding WIP with no activity past the stale limit, closed orders still holding WIP and negative WIP; lists past-due and over-completed orders.

| Finding | Example from the fictional demo data |
|---|---|
| `closed_with_wip` | WO-2004 is closed but still holds 2150 of WIP. Close it out or find the missing completion. |
| `negative_wip` | WO-2006 has negative WIP (-150): more was relieved than charged. Check completions and backflush. |
| `over_completed` | WO-2007 completed 60 against 50 ordered. |
| `past_due` | WO-2002 was due 2026-11-10 (20 days ago) and is still open. |
| `stale` | WO-2003 holds 8800 with no activity for 71 days (since 2026-09-20). |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `stale_days` | `30` | An open work order with WIP and no activity for this many days is flagged as stale |
| `buckets` | `[30,60,90]` | Age bucket edges in days since release |

<!-- generated:start -->

## A demo run

`npx -y fairmake-wip-aging demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake WIP Aging demo: ten fictional work orders aged as of 2026-11-30. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  10 work order(s) as of 2026-11-30, 8 open, 22650 in WIP: 9500 on stale orders, 2150 on closed ones. 4 to act on, 1 to review, 2 past due, 3 fine.
    watch        WO-2002                         past_due
    flag         WO-2003                         stale, past_due
    flag         WO-2004                         closed_with_wip
    flag         WO-2006                         negative_wip
    review       WO-2007                         over_completed
    watch        WO-2008                         past_due
    flag         WO-2010                         stale

▶ Explain WO-2004
  status: executed  decision: allow
  WO-2004: flag. WO-2004 is closed but still holds 2150 of WIP. Close it out or find the missing completion.

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  WIP aging as of 2026-11-30 written: 10 work order(s) as of 2026-11-30, 8 open, 22650 in WIP: 9500 on stale orders, 2150 on closed ones. 4 to act on, 1 to review, 2 past due, 3 fine.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  wip review open drafted for 11650 with 1 open marker(s) ([TO CONFIRM production control lead]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  wip review open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries erp_close_work_order itself
  status: blocked  decision: block
  reason: Never closes, completes or cancels a work order in the ERP.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `wip_check` | Age every work order by days since release and bucket the WIP. | runs |
| `wip_explain` | Show one work order's figures and findings, from the same files as wip_check. | runs |
| `wip_write_report` | Write wip-aging.csv (one row per work order, with a blank decision column for people to fill in) and wip-aging.html into out_dir (default fairmake-out/wip). | runs |
| `wip_draft_wip_review` | Write drafts/wip_review-open.md: every work order to act on or review, with WIP, idle days and reason, asking production control to confirm each. | asks first (Auto can be opted in) |
| `wip_request_send` | After one named human click (even in Auto), record that the reviewed wip review draft is approved in wip_review-requests.csv. | one named click, even in Auto (`binding_send`) |
| `erp_close_work_order` | Never closes, completes or cancels a work order in the ERP. | refused |
| `erp_post_journal` | Never posts a WIP write-off or any journal. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Work orders (`work_orders`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `work_order` (required) | text | Work Order, WO, Job, Job Number, Production Order, MO number | Fertigungsauftrag, Ordre de fabrication, 製造指図, 生产工单 |
| `item` | text | Item, Part, Assembly, Product, Part Number | Artikel, Article, 品目, 物料 |
| `wo_status` | text | Status, WO Status, Job Status, Order Status | - |
| `release_date` | date | Release Date, Released, Start Date, Date, Created | Freigabedatum, Date de lancement, 発行日, 下达日期 |
| `due_date` | date | Due Date, Due, End Date, Required Date, Scheduled End | Fälligkeitsdatum, Date d'échéance, 期日, 截止日期 |
| `last_activity` | date | Last Activity, Last Transaction, Last Labor Date, Last Issue Date, Last Updated | Letzte Aktivität, Dernière activité, 最終アクティビティ, 最后活动时间 |
| `wip_value` | amount | WIP Value, WIP, WIP Balance, Value in Process, WIP Amount | - |
| `qty_ordered` | number | Qty Ordered, Quantity, Planned Qty, Order Qty | Bestellmenge, Quantité commandée, 発注数, 订购数量 |
| `qty_completed` | number | Qty Completed, Built, Completed Qty, Qty Built | Gefertigte Menge, Quantité produite, 完成数, 完工数量 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| NetSuite | Work order saved search (default column labels) | Document Number, Assembly, Quantity, Built | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-wip-aging inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-wip-aging demo
npx -y fairmake-wip-aging mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-wip-aging": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-wip-aging",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-wip-aging -- npx -y fairmake-wip-aging mcp --root .`, or install the `fairmake-wip-aging` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-wip-aging approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-wip-aging approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-wip-aging kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-wip-aging tools                 # every tool, its policy and arguments
fairmake-wip-aging sources               # the columns each input is read from
fairmake-wip-aging inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-wip-aging call wip_check '{"work_orders":"<work_orders>"}'
fairmake-wip-aging eval                  # the private eval cases on the fictional fixtures
fairmake-wip-aging demo
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
