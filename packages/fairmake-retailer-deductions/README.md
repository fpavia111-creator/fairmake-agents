# Fairmake Retailer Deductions

`fairmake-retailer-deductions` · MCP server and CLI · MIT

Customer deductions and retailer chargebacks by reason, late-ASN fines and shortages checked against your records, dispute-by dates and dispute drafts. Writes nothing off.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

Classify each deduction by reason code, compute its dispute-by date from the customer's window, and check late-ASN fines against the ASN time and shortage claims against a clean POD and shipped quantity. Flags deductions your records contradict; reviews unknown reasons, missing invoices and categories that need documents; lists closed windows and small amounts.

| Finding | Example from the fictional demo data |
|---|---|
| `disputable` | Example Mart charged 250 for a late ASN, but the ASN for invoice INV-3001 went at 2026-10-20T16:30:00, 2.5 hours after shipping (2026-10-20T14:00:00). |
| `needs_evidence` | label deduction of 75: gather the routing guide, label and ASN records before deciding. |
| `no_reference` | Deduction D-9007 names no invoice. |
| `small_amount` | 30 is under 50: a write-off candidate if a person agrees. |
| `unknown_reason` | Reason code "ZZ9" is not in the reason map; classify it before deciding. |
| `window_closed` | The dispute window (30 days) closed on 2026-10-20. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## What it needs, and what stays with a person

- `deductions` (required): Deductions and chargebacks from remittances under --root: id, customer, date, amount, reason code, invoice, description
- `shipments` (optional): shipment evidence by invoice under --root: ship date and time, ASN sent time, clean POD (yes/no), quantities shipped and invoiced
- `as_of` (optional): Date to measure dispute windows from, YYYY-MM-DD (default today)
- `settings` (optional): settings JSON under --root; anything left out uses the defaults listed in the result as settings_used

It never does these, and any other tool name is blocked:

- Never writes off or accepts a deduction in AR.
- Never logs in to or submits disputes on a retailer portal.

`deductions_draft_dispute` writes a draft marked DRAFT; nothing goes out from it. Approving it (`deductions_request_send`) takes one click by a named person, even in Auto, and only records the approval: the agent itself sends, posts, files and pays nothing. What to change, send or pay is a person's decision.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `default_window_days` | `30` | Days from the deduction date to dispute it, for customers not named below |
| `dispute_window_days` | `{}` | Dispute window in days by customer (from your trading partner terms) |
| `small_amount` | `50` | Deductions under this amount are listed as write-off candidates (a person decides) |
| `asn_grace_hours` | `24` | An ASN sent within this many hours after shipping counts as on time |
| `reason_map` | `{"ASN":"asn_late","LBL":"label","RTE":"routing","SHT":"shortage","PRC":"pricing","PRM":"promotion","DMG":"damage"}` | Retailer reason code to category |

<!-- generated:start -->

## A demo run

`npx -y fairmake-retailer-deductions demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Retailer Deductions demo: nine fictional deductions from three fictional retailers, as of 2026-11-18. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  9 deduction(s), 1820 in total as of 2026-11-18: 430 disputable inside the window, 400 disputable but past it. 2 to dispute, 6 to look into, 1 closed or small, 0 accepted.
    flag         D-9001                          disputable
    flag         D-9002                          disputable
    review       D-9003                          needs_evidence
    watch        D-9004                          disputable, window_closed
    review       D-9005                          needs_evidence, small_amount
    review       D-9006                          needs_evidence
    review       D-9007                          unknown_reason, no_reference
    review       D-9008                          needs_evidence
    review       D-9009                          no_reference, needs_evidence

▶ Explain D-9001
  status: executed  decision: allow
  D-9001: flag. Example Mart charged 250 for a late ASN, but the ASN for invoice INV-3001 went at 2026-10-20T16:30:00, 2.5 hours after shipping (2026-10-20T14:00:00).

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Customer deductions and chargebacks written: 9 deduction(s), 1820 in total as of 2026-11-18: 430 disputable inside the window, 400 disputable but past it. 2 to dispute, 6 to look into, 1 closed or small, 0 accepted.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  dispute Example Mart drafted for 430 with 3 open marker(s) ([TO CONFIRM Example Mart deductions or vendor relations contact], [TO CONFIRM your vendor number], [ATTACH proof of delivery and ASN records]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  dispute Example-Mart approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries ar_write_off itself
  status: blocked  decision: block
  reason: Never writes off or accepts a deduction in AR.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `deductions_check` | Classify each deduction by reason code, compute its dispute-by date from the customer's window, and check late-ASN fines against the ASN time and shortage claims against a clean POD and shipped quantity. | runs |
| `deductions_explain` | Show one deduction's figures and findings, from the same files as deductions_check. | runs |
| `deductions_write_report` | Write retailer-deductions.csv (one row per deduction, with a blank decision column for people to fill in) and retailer-deductions.html, plus a calendar (.ics) of the due dates into out_dir (default fairmake-out/deduct… | runs |
| `deductions_draft_dispute` | Write drafts/dispute-<customer>.md: one customer's deductions that your records contradict and that are still inside the window, with the evidence. | asks first (Auto can be opted in) |
| `deductions_request_send` | After one named human click (even in Auto), record that the reviewed dispute draft is approved in dispute-requests.csv. | one named click, even in Auto (`binding_send`) |
| `ar_write_off` | Never writes off or accepts a deduction in AR. | refused |
| `retailer_portal_submit` | Never logs in to or submits disputes on a retailer portal. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Deductions and chargebacks (`deductions`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `deduction` (required) | text | Deduction, Deduction ID, Deduction Number, Chargeback ID, Debit Memo | - |
| `customer` (required) | text | Customer, Retailer, Trading Partner, Customer Name | Kunde, Client, 顧客, 客户 |
| `deduction_date` | date | Date, Deduction Date, Check Date, Remittance Date | - |
| `amount` | amount | Amount, Deduction Amount, Chargeback Amount | Betrag, Montant, 金額, 金额 |
| `reason_code` | text | Reason Code, Reason, Deduction Code, Code | Grundcode, Code motif, 理由コード, 原因代码 |
| `reference` | text | Reference, Invoice Number, Invoice, Invoice No. | Referenz, Référence, 参照番号, 参考号 |
| `description` | text | Description, Reason Description, Memo | Beschreibung, Description, 摘要, 摘要 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked |
|---|---|---|---|
| Retailer supplier portal (generic) | Remittance detail with deductions | Check Number, Invoice Number, Deduction Amount, Reason Code | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date; where it says "tested", an agent was run on a real published file in that layout. The other layouts were written from knowledge of the export and were not checked. None was tested against a customer's live account.

### Shipment evidence (`shipments`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `invoice` (required) | text | Invoice, Invoice Number, Invoice No. | Rechnungsnummer, N° de facture, 請求書番号, 发票号 |
| `po_number` | text | PO Number, Customer PO, PO | Bestellnummer, Bon de commande, 発注番号, 采购订单号 |
| `ship_date` | date and time | Ship Date, Shipped, Ship Datetime | Versanddatum, Date d'expédition, 出荷日, 发货日期 |
| `asn_sent` | date and time | ASN Sent, ASN Sent At, ASN Date, 856 Sent | - |
| `pod` | text | POD, Clean POD, Signed Clean, Proof of Delivery | Abliefernachweis, Preuve de livraison, 受領書, 签收单 |
| `qty_shipped` | number | Qty Shipped, Shipped Qty, Units Shipped | - |
| `qty_invoiced` | number | Qty Invoiced, Invoiced Qty, Units Invoiced | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-retailer-deductions inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-retailer-deductions demo
npx -y fairmake-retailer-deductions mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-retailer-deductions": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-retailer-deductions",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-retailer-deductions -- npx -y fairmake-retailer-deductions mcp --root .`, or install the `fairmake-retailer-deductions` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-retailer-deductions approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-retailer-deductions approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-retailer-deductions kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-retailer-deductions tools                 # every tool, its policy and arguments
fairmake-retailer-deductions sources               # the columns each input is read from
fairmake-retailer-deductions inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-retailer-deductions call deductions_check '{"deductions":"<deductions>"}'
fairmake-retailer-deductions eval                  # the private eval cases on the fictional fixtures
fairmake-retailer-deductions demo
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
