# fairmake-edi-asn-errors

Advance ship notices (856) against customer POs (850) and shipment records: missing or late ASNs, quantity mismatches, items not ordered, SSCC problems. Transmits nothing.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

Per customer PO: flags shipments with no ASN, ASNs sent later than the grace after shipping, ASN quantities that differ from the shipment record or exceed the PO, items not on the PO and SSCC labels reused across ASNs; reviews ASN lines with no SSCC and ASNs for POs not in the file. Reads an X12 file with 850s and 856s, or CSV tables.

| Finding | Example from the fictional demo data |
|---|---|
| `asn_item_not_on_po` | ASN for PO PO-8004 lists BRK-999, which is not on the PO. |
| `asn_late` | ASN ASN-2 for PO PO-8002 was sent 2026-11-08T10:00:00, 50 hours after shipping (2026-11-06T08:00:00). |
| `asn_over_po` | ASN for PO PO-8002 lists 12 of BRK-300 against 10 ordered. |
| `asn_qty_mismatch` | PO PO-8002, BRK-300: ASN says 12, the shipment record says 10. |
| `duplicate_sscc` | SSCC 000123450000000011 on PO PO-8001 also appears on another ASN. |
| `missing_sscc` | 1 ASN line(s) for PO PO-8003 carry no SSCC carton label. |
| `no_asn` | PO PO-8005 shipped on 2026-11-09 with no ASN sent. |
| `po_not_found` | ASN for PO PO-8099 but the PO is not in the orders file. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `note` | `` | Free text for your own records |
| `asn_grace_hours` | `1` | An ASN sent within this many hours after the shipment counts as on time (most retailer guides want it before the truck arrives) |
| `fines` | `{}` | Fine per finding code from the customer's compliance guide (no_asn, asn_late, asn_qty_mismatch, ...), to show the money at risk |

<!-- generated:start -->

## A demo run

`npx -y fairmake-edi-asn-errors demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake EDI ASN Errors demo: fictional customer POs, ASNs and shipment records. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  6 PO(s), 5 ASN(s): 4 with ASN errors (675 of fines at risk), 2 to check, 0 clean.
    flag         PO-8001                         duplicate_sscc
    flag         PO-8002                         asn_over_po, asn_qty_mismatch, asn_late
    review       PO-8003                         missing_sscc
    flag         PO-8004                         asn_item_not_on_po, asn_qty_mismatch, asn_qty_mismatch, duplicate_sscc
    flag         PO-8005                         no_asn
    review       PO-8099                         po_not_found

▶ Explain PO-8002
  status: executed  decision: allow
  PO-8002: flag. ASN for PO PO-8002 lists 12 of BRK-300 against 10 ordered. PO PO-8002, BRK-300: ASN says 12, the shipment record says 10. ASN ASN-2 for PO PO-8002 was sent 2026-11-08T10:00:00, 50 hours after shipping (2026-11-06T08:00:00).

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Advance ship notice checks written: 6 PO(s), 5 ASN(s): 4 with ASN errors (675 of fines at risk), 2 to check, 0 clean.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  asn correction open drafted for 675 with 1 open marker(s) ([TO CONFIRM EDI coordinator or 3PL contact]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  asn correction open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries edi_transmit itself
  status: blocked  decision: block
  reason: Never sends, resends or cancels an EDI document.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `asn_check` | Per customer PO: flags shipments with no ASN, ASNs sent later than the grace after shipping, ASN quantities that differ from the shipment record or exceed the PO, items not on the PO and SSCC labels reused across ASNs… | runs |
| `asn_explain` | Show one PO's figures and findings, from the same files as asn_check. | runs |
| `asn_write_report` | Write edi-asn-errors.csv (one row per PO, with a blank decision column for people to fill in) and edi-asn-errors.html into out_dir (default fairmake-out/asn). | runs |
| `asn_draft_asn_correction` | Write drafts/asn_correction-open.md: every PO with ASN errors, for the EDI coordinator or 3PL to correct and fix at the source. | asks first (Auto can be opted in) |
| `asn_request_send` | After one named human click (even in Auto), record that the reviewed asn correction draft is approved in asn_correction-requests.csv. | one named click, even in Auto (`binding_send`) |
| `edi_transmit` | Never sends, resends or cancels an EDI document. | refused |
| `erp_ship_confirm` | Never confirms or changes a shipment in the ERP or WMS. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Customer PO lines (`orders`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `po_number` (required) | text | PO Number, PO, Customer PO, Purchase Order | Bestellnummer, Bon de commande, 発注番号, 采购订单号 |
| `line` | text | Line, PO Line, Line Number | Position, Ligne, 明細番号, 行号 |
| `item` (required) | text | Item, Buyer Part, Part, SKU, UPC | Artikel, Article, 品目, 物料 |
| `qty` | number | Qty, Quantity, Qty Ordered, Ordered | Menge, Quantité, 数量, 数量 |
| `requested_ship` | date | Requested Ship, Ship Date Requested, Do Not Ship Before, Requested Date | - |

### ASN lines (`asns`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `asn` (required) | text | ASN, ASN Number, Shipment ID, BSN | - |
| `po_number` (required) | text | PO Number, PO, Customer PO | Bestellnummer, Bon de commande, 発注番号, 采购订单号 |
| `item` (required) | text | Item, Buyer Part, Part, SKU, UPC | Artikel, Article, 品目, 物料 |
| `qty` | number | Qty, Qty Shipped, Quantity, Units | Menge, Quantité, 数量, 数量 |
| `sscc` | text | SSCC, SSCC-18, Carton Label, Pallet ID | - |
| `ship_date` | date | Ship Date, Shipped | Versanddatum, Date d'expédition, 出荷日, 发货日期 |
| `sent_at` | date and time | Sent At, ASN Sent, Transmitted, Sent | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| EDI provider (generic) | ASN transaction report export | PO Number, ASN Number, SSCC, Ship Date | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Shipment records (`shipments`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `po_number` (required) | text | PO Number, PO, Customer PO | Bestellnummer, Bon de commande, 発注番号, 采购订单号 |
| `item` (required) | text | Item, Buyer Part, Part, SKU | Artikel, Article, 品目, 物料 |
| `qty` | number | Qty, Qty Shipped, Quantity | Menge, Quantité, 数量, 数量 |
| `ship_date` | date and time | Ship Date, Shipped At, Ship Datetime | Versanddatum, Date d'expédition, 出荷日, 发货日期 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-edi-asn-errors inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-edi-asn-errors demo
npx -y fairmake-edi-asn-errors mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-edi-asn-errors": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-edi-asn-errors",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-edi-asn-errors -- npx -y fairmake-edi-asn-errors mcp --root .`, or install the `fairmake-edi-asn-errors` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-edi-asn-errors approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-edi-asn-errors approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-edi-asn-errors kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-edi-asn-errors tools                 # every tool, its policy and arguments
fairmake-edi-asn-errors sources               # the columns each input is read from
fairmake-edi-asn-errors inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-edi-asn-errors call asn_check '{}'
fairmake-edi-asn-errors eval                  # the private eval cases on the fictional fixtures
fairmake-edi-asn-errors demo
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
