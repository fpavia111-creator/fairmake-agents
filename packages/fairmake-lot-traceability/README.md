# Fairmake Lot Traceability

`fairmake-lot-traceability` · MCP server and CLI · MIT

Breaks in the chain from received lots through production to shipments: missing lots, lots never received or used before receipt, unknown shipped lots and serials shipped twice.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

Link received lots to the finished lots they went into and the shipments that carried them. Flags issues with no component lot or no finished lot, lots used before receipt, shipments with no lot, shipped lots never produced or received and serials on two shipments; reviews component lots missing from receipts.

| Finding | Example from the fictional demo data |
|---|---|
| `consumed_without_lot` | SEAL-10 was issued to FG-1002 with no component lot (record C5). |
| `lot_not_received` | Component lot RL-599 (GSK-220) used in FG-1003 is not in the receipts or production records. |
| `serial_shipped_twice` | Serial SN-7001 went out on 2 shipments (S3 2026-11-10, S4 2026-11-12). |
| `shipped_no_lot` | Shipment S5 of PMP-100 to Demo Ag Equipment has no lot or serial number. |
| `shipped_unknown_lot` | Lot or serial SN-7001 shipped on S3, S4 was never produced or received in these records. |
| `used_before_received` | Lot RL-503 was issued to FG-1002 on 2026-11-02, before it was received on 2026-11-06. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## What it needs, and what stays with a person

- `consumption` (required): Material issues to production under --root: record, work order, finished lot, component, component lot, quantity, date
- `receipts` (required): Received lots under --root: lot, item, receipt date, supplier
- `shipments` (required): Shipments under --root: shipment, customer, item, lot or serial number, ship date, quantity

It never does these, and any other tool name is blocked:

- Never edits lot, serial or genealogy records.
- Never sends a recall or customer notice.

`trace_draft_trace_gaps` writes a draft marked DRAFT; nothing goes out from it. Approving it (`trace_request_send`) takes one click by a named person, even in Auto, and only records the approval: the agent itself sends, posts, files and pays nothing. What to change, send or pay is a person's decision.

<!-- generated:start -->

## A demo run

`npx -y fairmake-lot-traceability demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Lot Traceability demo: fictional receipts, production issues and shipments for a small assembly line. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  5 finished lot(s), 9 issue record(s), 4 received lot(s), 7 shipment line(s): 4 break(s) in the chain, 1 to check, 2 clean.
    flag         FG-1002                         used_before_received, consumed_without_lot
    review       FG-1003                         lot_not_received
    flag         WO-4 (no finished lot)          consumed_without_lot
    flag         S5 (no lot)                     shipped_no_lot
    flag         SN-7001                         shipped_unknown_lot, serial_shipped_twice

▶ Explain FG-1002
  status: executed  decision: allow
  FG-1002: flag. Lot RL-503 was issued to FG-1002 on 2026-11-02, before it was received on 2026-11-06. SEAL-10 was issued to FG-1002 with no component lot (record C5).

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Lot and serial traceability written: 5 finished lot(s), 9 issue record(s), 4 received lot(s), 7 shipment line(s): 4 break(s) in the chain, 1 to check, 2 clean.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  trace gaps open drafted with 1 open marker(s) ([TO CONFIRM quality manager]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  trace gaps open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries erp_edit_lot_history itself
  status: blocked  decision: block
  reason: Never edits lot, serial or genealogy records.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `trace_check` | Link received lots to the finished lots they went into and the shipments that carried them. | runs |
| `trace_explain` | Show one lot or shipment's figures and findings, from the same files as trace_check. | runs |
| `trace_write_report` | Write lot-traceability.csv (one row per lot or shipment, with a blank decision column for people to fill in) and lot-traceability.html into out_dir (default fairmake-out/trace). | runs |
| `trace_draft_trace_gaps` | Write drafts/trace_gaps-open.md: every break in the lot chain, for the quality manager to fix at the source. | asks first (Auto can be opted in) |
| `trace_request_send` | After one named human click (even in Auto), record that the reviewed trace gaps draft is approved in trace_gaps-requests.csv. | one named click, even in Auto (`binding_send`) |
| `erp_edit_lot_history` | Never edits lot, serial or genealogy records. | refused |
| `recall_notice_send` | Never sends a recall or customer notice. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Material issues (`consumption`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `record` (required) | text | Record, Line ID, Transaction, Issue ID | - |
| `work_order` | text | Work Order, Job, Production Order, Document Number | Fertigungsauftrag, Ordre de fabrication, 製造指図, 生产工单 |
| `finished_lot` | text | Finished Lot, Assembly Lot, Output Lot, Parent Lot, Batch | - |
| `component` (required) | text | Component, Component Item, Material, Part | Komponente, Composant, 子品目, 子项 |
| `component_lot` | text | Component Lot, Lot/Serial Number, Lot Number, Lot, Material Lot | - |
| `qty` | number | Qty, Quantity, Qty Issued | Menge, Quantité, 数量, 数量 |
| `consume_date` | date | Date, Issue Date, Consumed, Transaction Date | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked |
|---|---|---|---|
| NetSuite | Assembly build components with inventory detail (saved search) | Document Number, Assembly, Component, Lot/Serial Number | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date; where it says "tested", an agent was run on a real published file in that layout. The other layouts were written from knowledge of the export and were not checked. None was tested against a customer's live account.

### Received lots (`receipts`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `lot` (required) | text | Lot, Lot Number, Lot/Serial Number, Batch | Charge, Lot, ロット, 批次 |
| `item` | text | Item, Part, Part Number | Artikel, Article, 品目, 物料 |
| `receipt_date` | date | Receipt Date, Received, Date | Eingangsdatum, Date de réception, 受領日, 收到日期 |
| `supplier` | text | Supplier, Vendor | Lieferant, Fournisseur, 仕入先, 供应商 |

### Shipments (`shipments`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `shipment` (required) | text | Shipment, Shipment ID, Packing Slip, Delivery | - |
| `customer` | text | Customer, Ship To | Kunde, Client, 顧客, 客户 |
| `item` | text | Item, Part, Part Number | Artikel, Article, 品目, 物料 |
| `lot_or_serial` | text | Lot or Serial, Lot/Serial Number, Serial Number, Lot, Serial | Seriennummer, Numéro de série, シリアル番号, 序列号 |
| `ship_date` | date | Ship Date, Shipped, Date | Versanddatum, Date d'expédition, 出荷日, 发货日期 |
| `qty` | number | Qty, Quantity, Qty Shipped | Menge, Quantité, 数量, 数量 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-lot-traceability inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-lot-traceability demo
npx -y fairmake-lot-traceability mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-lot-traceability": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-lot-traceability",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-lot-traceability -- npx -y fairmake-lot-traceability mcp --root .`, or install the `fairmake-lot-traceability` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-lot-traceability approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-lot-traceability approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-lot-traceability kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-lot-traceability tools                 # every tool, its policy and arguments
fairmake-lot-traceability sources               # the columns each input is read from
fairmake-lot-traceability inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-lot-traceability call trace_check '{"consumption":"<consumption>","receipts":"<receipts>","shipments":"<shipments>"}'
fairmake-lot-traceability eval                  # the private eval cases on the fictional fixtures
fairmake-lot-traceability demo
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
