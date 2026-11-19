# Fairmake Late Purchase Orders

`fairmake-late-purchase-orders` · MCP server and CLI · MIT

Open PO lines past due, unconfirmed, promised after the production need date or over-received, by supplier, with delivery status requests. Changes no PO.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

For each open line: flags lines past the promise date (or the due date when there is no promise) and promises after the production need date; reviews lines with no promise some days after ordering and lines received over the ordered quantity; lists promises later than the requested date. Totals by supplier.

| Finding | Example from the fictional demo data |
|---|---|
| `no_promise` | PO-602 BAR-4140: no promise date 8 days after ordering. |
| `over_received` | PO-604 HSG-300: 22 received against 20 ordered. |
| `past_due` | PO-601 BAR-4140: 1000 still open 19 days after the promise date 2026-10-30 (4800). |
| `promise_after_due` | PO-601 BAR-4140: promised 2026-10-30, after the requested 2026-10-25. |
| `promise_after_need` | PO-601 BAR-1018: promised 2026-11-28, production needs it 2026-11-20 (8 days late). |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## What it needs, and what stays with a person

- `po_lines` (required): Open purchase order lines under --root: line, PO, supplier, item, order, due, promise and need dates, quantities ordered and received, price
- `as_of` (optional): Date to measure from, YYYY-MM-DD (default today)
- `settings` (optional): settings JSON under --root; anything left out uses the defaults listed in the result as settings_used

It never does these, and any other tool name is blocked:

- Never logs in to or updates a supplier portal.
- Never changes, re-dates or cancels a purchase order.

`open_po_draft_expedite_request` writes a draft marked DRAFT; nothing goes out from it. Approving it (`open_po_request_send`) takes one click by a named person, even in Auto, and only records the approval: the agent itself sends, posts, files and pays nothing. What to change, send or pay is a person's decision.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `confirm_days` | `3` | An open line with no promise date this many days after ordering is unconfirmed |
| `grace_days` | `0` | Days past the promise (or due) date before a line counts as past due |

<!-- generated:start -->

## A demo run

`npx -y fairmake-late-purchase-orders demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Late Purchase Orders demo: ten fictional open PO lines from four suppliers, as of 2026-11-18. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  10 PO line(s) as of 2026-11-18, 8 open worth 18270: 6760 past due. 4 late or at risk, 2 unconfirmed or over-received, 1 promised late, 3 on track.
    flag         PO-601-1                        past_due, promise_after_due
    flag         PO-601-2                        promise_after_need
    review       PO-602-1                        no_promise
    flag         PO-603-1                        past_due
    watch        PO-603-2                        promise_after_due
    review       PO-604-2                        over_received
    flag         PO-606-1                        past_due

▶ Explain PO-601-1
  status: executed  decision: allow
  PO-601-1: flag. PO-601 BAR-4140: 1000 still open 19 days after the promise date 2026-10-30 (4800). PO-601 BAR-4140: promised 2026-10-30, after the requested 2026-10-25.

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Open purchase orders as of 2026-11-18 written: 10 PO line(s) as of 2026-11-18, 8 open worth 18270: 6760 past due. 4 late or at risk, 2 unconfirmed or over-received, 1 promised late, 3 on track.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  expedite request Northwind Metals drafted for 9650 with 1 open marker(s) ([TO CONFIRM Northwind Metals order desk or account contact]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  expedite request Northwind-Metals approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries supplier_portal_update itself
  status: blocked  decision: block
  reason: Never logs in to or updates a supplier portal.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `open_po_check` | For each open line: flags lines past the promise date (or the due date when there is no promise) and promises after the production need date; reviews lines with no promise some days after ordering and lines received o… | runs |
| `open_po_explain` | Show one PO line's figures and findings, from the same files as open_po_check. | runs |
| `open_po_write_report` | Write late-purchase-orders.csv (one row per PO line, with a blank decision column for people to fill in) and late-purchase-orders.html into out_dir (default fairmake-out/open-po). | runs |
| `open_po_draft_expedite_request` | Write drafts/expedite_request-<supplier>.md: one supplier's past-due, unconfirmed and at-risk lines, asking for confirmed ship dates. | asks first (Auto can be opted in) |
| `open_po_request_send` | After one named human click (even in Auto), record that the reviewed expedite request draft is approved in expedite_request-requests.csv. | one named click, even in Auto (`binding_send`) |
| `supplier_portal_update` | Never logs in to or updates a supplier portal. | refused |
| `erp_cancel_po` | Never changes, re-dates or cancels a purchase order. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Open purchase order lines (`po_lines`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `po_line` (required) | text | PO Line, Line ID, PO Line ID | Position, Ligne, 明細番号, 行号 |
| `po_number` | text | PO Number, PO, Purchase Order, Document Number | Bestellnummer, Bon de commande, 発注番号, 采购订单号 |
| `supplier` | text | Supplier, Vendor, Vendor Name, Supplier Name | Lieferant, Fournisseur, 仕入先, 供应商 |
| `item` | text | Item, Part, Item No., Part Number | Artikel, Article, 品目, 物料 |
| `order_date` | date | Order Date, PO Date, Posting Date, Created | Bestelldatum, Date de commande, 注文日, 下单日期 |
| `due_date` | date | Due Date, Delivery Date, Requested Date, Required Date | Fälligkeitsdatum, Date d'échéance, 期日, 截止日期 |
| `promise_date` | date | Promise Date, Promised Date, Confirmed Date, Supplier Promise | Zugesagter Termin, Date promise, 回答納期, 承诺日期 |
| `qty_ordered` | number | Qty Ordered, Quantity, Order Qty | Bestellmenge, Quantité commandée, 発注数, 订购数量 |
| `qty_received` | number | Qty Received, Received, Received Qty | Gelieferte Menge, Quantité reçue, 入荷数, 收货数量 |
| `unit_price` | amount | Unit Price, Price, Rate | Einzelpreis, Prix unitaire, 単価, 单价 |
| `need_date` | date | Need Date, Required by Production, MRP Need Date, Demand Date | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| SAP Business One | Open Items List, purchase orders | Document Number, Vendor Name, Item No., Open Qty | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-late-purchase-orders inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-late-purchase-orders demo
npx -y fairmake-late-purchase-orders mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-late-purchase-orders": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-late-purchase-orders",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-late-purchase-orders -- npx -y fairmake-late-purchase-orders mcp --root .`, or install the `fairmake-late-purchase-orders` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-late-purchase-orders approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-late-purchase-orders approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-late-purchase-orders kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-late-purchase-orders tools                 # every tool, its policy and arguments
fairmake-late-purchase-orders sources               # the columns each input is read from
fairmake-late-purchase-orders inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-late-purchase-orders call open_po_check '{"po_lines":"<po_lines>"}'
fairmake-late-purchase-orders eval                  # the private eval cases on the fictional fixtures
fairmake-late-purchase-orders demo
```

## Audit log and data

Every call is written to `.fairmake/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Reads only the files you give it. It does not log in to an ERP, MES, CMMS, QMS, EDI network, bank, supplier or customer portal, and changes nothing in them.
- Thresholds and rules are settings in your own file, with working defaults listed in the result as settings_used. They are not a costing, quality or safety standard; check them against your own policies and contracts.
- Not legal, tax, customs, safety or accounting advice. A person decides what to change, post, send or pay.
- Column names for the named exports were written from knowledge of those systems and not checked against a live account; `inspect` shows how a file was read and `fairmake-sources.json` names columns by hand.
- The bundled fixtures are fictional. Version 0.1.0.
