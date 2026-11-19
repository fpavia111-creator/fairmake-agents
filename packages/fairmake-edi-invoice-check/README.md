# fairmake-edi-invoice-check

Your invoices to customers (EDI 810 or tables) against their purchase orders (850): price and quantity differences, items not ordered, unknown POs and duplicates. Transmits nothing.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

Match every invoice line to the customer's PO line by PO and item. Flags unit prices off the PO beyond the tolerance, quantities invoiced beyond the PO across invoices, items not on the PO and POs not found; reviews invoices with the same lines as an earlier one and 810 totals that do not equal their lines. Reads an X12 file with 850s and 810s, or CSV tables.

| Finding | Example from the fictional demo data |
|---|---|
| `item_not_on_po` | Invoice INV-4005 bills 5 of BRK-999, which is not on PO PO-9003. |
| `po_not_found` | Invoice INV-4006 names PO PO-9999, which is not among the customer orders. |
| `possible_duplicate` | Invoice INV-4007 has the same lines as invoice INV-4002. |
| `price_mismatch` | Invoice INV-4002 bills BRK-300 at 12.6; PO PO-9002 says 12. A retailer usually deducts the difference (24). |
| `qty_over_po` | BRK-100 on PO PO-9003: 70 invoiced so far against 60 ordered. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `note` | `` | Free text for your own records |
| `price_tolerance` | `0.01` | Unit price differences up to this amount are ignored |

<!-- generated:start -->

## A demo run

`npx -y fairmake-edi-invoice-check demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake EDI Invoice Check demo: fictional customer POs and invoices. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  7 invoice(s) against 3 customer PO(s), 2195.5 invoiced: 5 differ from the PO (612 at risk), 0 to check, 2 match.
    flag         INV-4002                        price_mismatch
    flag         INV-4004                        qty_over_po
    flag         INV-4005                        item_not_on_po
    flag         INV-4006                        po_not_found
    flag         INV-4007                        price_mismatch, qty_over_po, possible_duplicate

▶ Explain INV-4002
  status: executed  decision: allow
  INV-4002: flag. Invoice INV-4002 bills BRK-300 at 12.6; PO PO-9002 says 12. A retailer usually deducts the difference (24).

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Customer invoices against customer orders written: 7 invoice(s) against 3 customer PO(s), 2195.5 invoiced: 5 differ from the PO (612 at risk), 0 to check, 2 match.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  invoice correction open drafted for 612 with 1 open marker(s) ([TO CONFIRM billing or AR lead]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  invoice correction open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries edi_transmit itself
  status: blocked  decision: block
  reason: Never sends, resends or cancels an EDI invoice.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `edi_invoice_check` | Match every invoice line to the customer's PO line by PO and item. | runs |
| `edi_invoice_explain` | Show one invoice's figures and findings, from the same files as edi_invoice_check. | runs |
| `edi_invoice_write_report` | Write edi-invoice-check.csv (one row per invoice, with a blank decision column for people to fill in) and edi-invoice-check.html into out_dir (default fairmake-out/edi-invoice). | runs |
| `edi_invoice_draft_invoice_correction` | Write drafts/invoice_correction-open.md: every invoice that differs from the customer PO, with the amount at risk, for billing to correct before the customer deducts. | asks first (Auto can be opted in) |
| `edi_invoice_request_send` | After one named human click (even in Auto), record that the reviewed invoice correction draft is approved in invoice_correction-requests.csv. | one named click, even in Auto (`binding_send`) |
| `edi_transmit` | Never sends, resends or cancels an EDI invoice. | refused |
| `ar_issue_credit` | Never issues a credit memo or changes an invoice in AR. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Customer PO lines (`orders`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `po_number` (required) | text | PO Number, PO, Customer PO, P. O. # | Bestellnummer, Bon de commande, 発注番号, 采购订单号 |
| `line` | text | Line, PO Line, Line Number | Position, Ligne, 明細番号, 行号 |
| `item` (required) | text | Item, Buyer Part, Part, SKU | Artikel, Article, 品目, 物料 |
| `qty` | number | Qty, Quantity, Qty Ordered | Menge, Quantité, 数量, 数量 |
| `unit_price` | amount | Unit Price, Price, PO Price | Einzelpreis, Prix unitaire, 単価, 单价 |

### Invoice lines (`invoices`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `invoice` (required) | text | Invoice, Invoice Number, Num, Invoice No. | Rechnungsnummer, N° de facture, 請求書番号, 发票号 |
| `po_number` | text | PO Number, PO, Customer PO, P. O. # | Bestellnummer, Bon de commande, 発注番号, 采购订单号 |
| `line` | text | Line, Invoice Line, Line Number | Position, Ligne, 明細番号, 行号 |
| `item` | text | Item, Buyer Part, Part, SKU | Artikel, Article, 品目, 物料 |
| `qty` | number | Qty, Quantity, Qty Invoiced | Menge, Quantité, 数量, 数量 |
| `unit_price` | amount | Unit Price, Price, Sales Price, Rate | Einzelpreis, Prix unitaire, 単価, 单价 |
| `invoice_date` | date | Invoice Date, Date | Rechnungsdatum, Date de facture, 請求日, 发票日期 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| QuickBooks Enterprise | Sales by Customer Detail report (CSV) | Type, Num, Name, Item, Sales Price | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-edi-invoice-check inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-edi-invoice-check demo
npx -y fairmake-edi-invoice-check mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-edi-invoice-check": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-edi-invoice-check",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-edi-invoice-check -- npx -y fairmake-edi-invoice-check mcp --root .`, or install the `fairmake-edi-invoice-check` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-edi-invoice-check approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-edi-invoice-check approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-edi-invoice-check kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-edi-invoice-check tools                 # every tool, its policy and arguments
fairmake-edi-invoice-check sources               # the columns each input is read from
fairmake-edi-invoice-check inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-edi-invoice-check call edi_invoice_check '{}'
fairmake-edi-invoice-check eval                  # the private eval cases on the fictional fixtures
fairmake-edi-invoice-check demo
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
