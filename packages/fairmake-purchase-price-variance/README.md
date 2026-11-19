# Fairmake Purchase Price Variance

`fairmake-purchase-price-variance` · MCP server and CLI · MIT

Receipt prices against standard cost, price jumps and unit-of-measure slips by supplier, with a price query draft. Changes no standard.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

Measure every receipt line against standard cost. Flags lines over both the percentage and the amount tolerance, lists price jumps from the same supplier, likely unit-of-measure slips and items with no standard, and names standards that every receipt disagrees with. Returns totals by supplier.

| Finding | Example from the fictional demo data |
|---|---|
| `no_standard` | GSK-220 has no standard cost, so receipt RC-1008-1 at 1.25 cannot be measured. |
| `ppv_favorable` | PLT-A36 received at 52, 14.8% under standard 61 (360 on 40). Check the standard is still right. |
| `ppv_unfavorable` | BAR-4140 received at 4.75 against standard 4 (18.8% over) on 250: 187.5. |
| `price_jump` | North Example Metals charged 4.75 for BAR-4140, up 15.9% from 4.1 on receipt RC-1001-1. |
| `uom_suspect` | Price 6 is 120 times the standard 0.05: likely a unit-of-measure slip (each against box or pound against foot). Fix the unit before reading a variance. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## What it needs, and what stays with a person

- `receipts` (required): Purchase receipt lines under --root (CSV, Excel or JSON): item, supplier, quantity, unit price and standard cost per receipt line
- `settings` (optional): settings JSON under --root; anything left out uses the defaults listed in the result as settings_used

It never does these, and any other tool name is blocked:

- Never changes standard costs in the item master; the cost accountant does that after review.
- Never pays, holds or short-pays a supplier invoice.

`ppv_draft_price_query` writes a draft marked DRAFT; nothing goes out from it. Approving it (`ppv_request_send`) takes one click by a named person, even in Auto, and only records the approval: the agent itself sends, posts, files and pays nothing. What to change, send or pay is a person's decision.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `tolerance_pct` | `5` | A receipt line is flagged when its price is more than this percentage over standard |
| `tolerance_amount` | `100` | and its variance (price minus standard, times quantity) is more than this amount |
| `jump_pct` | `10` | A price this far above the same supplier's previous receipt of the item is listed to watch |
| `uom_factor` | `8` | A price this many times above or below standard is read as a unit-of-measure slip, not a variance |

<!-- generated:start -->

## A demo run

`npx -y fairmake-purchase-price-variance demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Purchase Price Variance demo: twelve fictional receipt lines from four fictional suppliers. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  12 receipt line(s), 37677.5 received: purchase price variance 282.5. 3 over tolerance (777.5), 2 to review, 2 to watch, 5 clean; 1 standard(s) to review.
    flag         RC-1002-1                       ppv_unfavorable, price_jump
    flag         RC-1003-1                       ppv_unfavorable
    review       RC-1005-1                       uom_suspect
    watch        RC-1006-1                       ppv_favorable
    watch        RC-1007-1                       ppv_favorable
    review       RC-1008-1                       no_standard
    flag         RC-1010-1                       ppv_unfavorable, price_jump

▶ Explain RC-1003-1
  status: executed  decision: allow
  RC-1003-1: flag. BAR-4140 received at 4.8 against standard 4 (20% over) on 300: 240.

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Purchase price variance written: 12 receipt line(s), 37677.5 received: purchase price variance 282.5. 3 over tolerance (777.5), 2 to review, 2 to watch, 5 clean; 1 standard(s) to review.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  price query North Example Metals drafted for 427.5 with 1 open marker(s) ([TO CONFIRM North Example Metals sales or account contact]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  price query North-Example-Metals approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries erp_update_standard_cost itself
  status: blocked  decision: block
  reason: Never changes standard costs in the item master; the cost accountant does that after review.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `ppv_check` | Measure every receipt line against standard cost. | runs |
| `ppv_explain` | Show one receipt line's figures and findings, from the same files as ppv_check. | runs |
| `ppv_write_report` | Write purchase-price-variance.csv (one row per receipt line, with a blank decision column for people to fill in) and purchase-price-variance.html into out_dir (default fairmake-out/ppv). | runs |
| `ppv_draft_price_query` | Write drafts/price_query-<supplier>.md: the receipt lines from one supplier priced over standard or up from the last price, asking for the agreed price or a credit note. | asks first (Auto can be opted in) |
| `ppv_request_send` | After one named human click (even in Auto), record that the reviewed price query draft is approved in price_query-requests.csv. | one named click, even in Auto (`binding_send`) |
| `erp_update_standard_cost` | Never changes standard costs in the item master; the cost accountant does that after review. | refused |
| `ap_pay_invoice` | Never pays, holds or short-pays a supplier invoice. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Purchase receipt lines (`receipts`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `receipt` (required) | text | Receipt, Receipt Line, Receipt No., Receipt Nbr., GRN, Receiving Line | Wareneingang, Réception, 入庫番号, 收货单号 |
| `po_number` | text | PO Number, PO, Purchase Order, PO No., Base Document | Bestellnummer, Bon de commande, 発注番号, 采购订单号 |
| `item` (required) | text | Item, Item No., Part, Part Number, Inventory ID, SKU | Artikel, Article, 品目, 物料 |
| `supplier` | text | Supplier, Vendor, Vendor Name, Vendor Code, Supplier Name | Lieferant, Fournisseur, 仕入先, 供应商 |
| `receipt_date` | date | Receipt Date, Received Date, Posting Date, Date Received, Date | Eingangsdatum, Date de réception, 受領日, 收到日期 |
| `qty` | number | Qty, Quantity, Qty Received, Received Qty, Receipt Qty. | Menge, Quantité, 数量, 数量 |
| `unit_price` | amount | Unit Price, Price, PO Price, Unit Cost, Rate | Einzelpreis, Prix unitaire, 単価, 单价 |
| `std_cost` | amount | Std Cost, Standard Cost, Standard, Item Cost | Standardpreis, Coût standard, 標準原価, 标准成本 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked |
|---|---|---|---|
| SAP Business One | Goods Receipt PO document rows export | Document Number, Vendor Code, Item No., Unit Price | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date; where it says "tested", an agent was run on a real published file in that layout. The other layouts were written from knowledge of the export and were not checked. None was tested against a customer's live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-purchase-price-variance inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-purchase-price-variance demo
npx -y fairmake-purchase-price-variance mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-purchase-price-variance": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-purchase-price-variance",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-purchase-price-variance -- npx -y fairmake-purchase-price-variance mcp --root .`, or install the `fairmake-purchase-price-variance` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-purchase-price-variance approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-purchase-price-variance approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-purchase-price-variance kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-purchase-price-variance tools                 # every tool, its policy and arguments
fairmake-purchase-price-variance sources               # the columns each input is read from
fairmake-purchase-price-variance inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-purchase-price-variance call ppv_check '{"receipts":"<receipts>"}'
fairmake-purchase-price-variance eval                  # the private eval cases on the fictional fixtures
fairmake-purchase-price-variance demo
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
