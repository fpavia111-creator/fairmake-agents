# Fairmake Order Backlog

`fairmake-order-backlog` · MCP server and CLI · MIT

Open customer order lines past due, due soon, never promised, promised after the requested date or on hold, by promise month and customer, with status update drafts. Changes no date.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

For each open line (open quantity, not closed): flags lines past the promise date (or the requested date when there is no promise); lists lines due within the at-risk window and promises later than requested; reviews lines with no promise and lines on hold. Totals by promise month and customer.

| Finding | Example from the fictional demo data |
|---|---|
| `due_soon` | SO-503 ACT-9 is due 2026-11-22 (in 4 days). |
| `no_promise` | SO-503 ACT-9 has no promise date. |
| `on_hold` | SO-504 is on hold (Credit Hold). |
| `past_due` | SO-501 PMP-100 for Example Pumps Co: 5 open, promised 2026-11-05 (13 days ago), 2000 of backlog. |
| `promised_after_request` | SO-501 PMP-100: promised 2026-11-05, the customer asked for 2026-11-01 (4 days later). |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `at_risk_days` | `7` | An open line promised within this many days is listed as due soon |

<!-- generated:start -->

## A demo run

`npx -y fairmake-order-backlog demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Order Backlog demo: ten fictional open order lines for four customers, as of 2026-11-18. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  8 open line(s) as of 2026-11-18, 8150 of backlog: 2700 past due on 2 line(s), 2 not promised or on hold, 2 due soon or promised late, 2 on schedule.
    flag         SO-501-1                        past_due, promised_after_request
    watch        SO-502-1                        promised_after_request
    watch        SO-503-1                        due_soon
    review       SO-503-2                        no_promise
    flag         SO-504-1                        past_due, promised_after_request
    review       SO-504-2                        on_hold

▶ Explain SO-501-1
  status: executed  decision: allow
  SO-501-1: flag. SO-501 PMP-100 for Example Pumps Co: 5 open, promised 2026-11-05 (13 days ago), 2000 of backlog. SO-501 PMP-100: promised 2026-11-05, the customer asked for 2026-11-01 (4 days later).

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Order backlog and promise dates as of 2026-11-18 written: 8 open line(s) as of 2026-11-18, 8150 of backlog: 2700 past due on 2 line(s), 2 not promised or on hold, 2 due soon or promised late, 2 on schedule.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  promise update Example Pumps Co drafted for 3200 with 2 open marker(s) ([TO CONFIRM Example Pumps Co buyer], [CHECK with production before sending]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  promise update Example-Pumps-Co approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries erp_change_promise_date itself
  status: blocked  decision: block
  reason: Never changes promise or ship dates in the ERP.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `backlog_check` | For each open line (open quantity, not closed): flags lines past the promise date (or the requested date when there is no promise); lists lines due within the at-risk window and promises later than requested; reviews … | runs |
| `backlog_explain` | Show one order line's figures and findings, from the same files as backlog_check. | runs |
| `backlog_write_report` | Write order-backlog.csv (one row per order line, with a blank decision column for people to fill in) and order-backlog.html into out_dir (default fairmake-out/backlog). | runs |
| `backlog_draft_promise_update` | Write drafts/promise_update-<customer>.md: one customer's late, unpromised and later-than-asked lines, with a reminder to check new dates with production. | asks first (Auto can be opted in) |
| `backlog_request_send` | After one named human click (even in Auto), record that the reviewed promise update draft is approved in promise_update-requests.csv. | one named click, even in Auto (`binding_send`) |
| `erp_change_promise_date` | Never changes promise or ship dates in the ERP. | refused |
| `customer_email_send` | Never emails or messages a customer. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Open sales order lines (`orders`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `order_line` (required) | text | Order Line, Line ID, SO Line, Order Line ID | Position, Ligne, 明細番号, 行号 |
| `order_number` | text | Order Number, Sales Order, SO, Document Number, Order No. | Bestellnummer, N° de commande, 注文番号, 订单号 |
| `customer` | text | Customer, Customer Name, Sold To, Bill To | Kunde, Client, 顧客, 客户 |
| `item` | text | Item, Part, Part Number, SKU | Artikel, Article, 品目, 物料 |
| `order_date` | date | Order Date, Date, Entered | Bestelldatum, Date de commande, 注文日, 下单日期 |
| `requested_date` | date | Requested Date, Customer Requested Date, Need By, Request Date | Wunschtermin, Date souhaitée, 希望納期, 要求日期 |
| `promise_date` | date | Promise Date, Promised Date, Expected Ship Date, Committed Date, Ship By | Zugesagter Termin, Date promise, 回答納期, 承诺日期 |
| `qty_open` | number | Qty Open, Open Qty, Quantity Remaining, Backorder Qty, Remaining | Menge, Quantité, 数量, 数量 |
| `unit_price` | amount | Unit Price, Price, Rate | Einzelpreis, Prix unitaire, 単価, 单价 |
| `line_status` | text | Status, Line Status, Order Status | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| NetSuite | Open sales order lines (saved search) | Document Number, Customer, Item, Expected Ship Date | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-order-backlog inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-order-backlog demo
npx -y fairmake-order-backlog mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-order-backlog": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-order-backlog",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-order-backlog -- npx -y fairmake-order-backlog mcp --root .`, or install the `fairmake-order-backlog` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-order-backlog approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-order-backlog approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-order-backlog kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-order-backlog tools                 # every tool, its policy and arguments
fairmake-order-backlog sources               # the columns each input is read from
fairmake-order-backlog inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-order-backlog call backlog_check '{"orders":"<orders>"}'
fairmake-order-backlog eval                  # the private eval cases on the fictional fixtures
fairmake-order-backlog demo
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
