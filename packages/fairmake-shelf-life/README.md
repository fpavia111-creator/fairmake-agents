# Fairmake Shelf Life

`fairmake-shelf-life` · MCP server and CLI · MIT

Expired lots on hand, lots expiring soon or with no expiry, and shipments that went out expired, short-dated or out of first-expired-first-out order, with an expiry calendar.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

For each lot: flags expired stock on hand, shipments made after expiry and shipments with fewer days left than the customer's minimum; reviews lots with no expiry date and shipments that took a newer lot while an older one was in stock; lists lots expiring within the warning window.

| Finding | Example from the fictional demo data |
|---|---|
| `expired_on_hand` | Lot L-2601 (ADH-10) expired 2026-10-31 with 40 still on hand (720). |
| `expiring_soon` | Lot L-2602 (ADH-10) expires 2026-12-15 (in 27 days) with 120 on hand. |
| `fefo_skipped` | Shipment S-2 on 2026-11-10 took lot L-2603 (expires 2027-05-01) while L-2602 (expires 2026-12-15) was in stock and is still on hand. |
| `no_expiry` | Lot L-2604 (SEAL-K) holds 60 and has no expiry date. |
| `shipped_expired` | Shipment S-3 to Sample Hardware on 2026-11-03 carried lot L-2605, expired 2026-11-01. |
| `short_dated_shipment` | Shipment S-1 to Example Mart on 2026-11-05 carried lot L-2602 with 40 days left; the customer needs 90. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## What it needs, and what stays with a person

- `lots` (required): Lots on hand under --root: lot, item, location, quantity, manufacture and expiry dates, unit cost
- `shipments` (optional): shipments by lot under --root: shipment, customer, item, lot, ship date and quantity
- `as_of` (optional): Date to measure from, YYYY-MM-DD (default today)
- `settings` (optional): settings JSON under --root; anything left out uses the defaults listed in the result as settings_used

It never does these, and any other tool name is blocked:

- Never scraps or writes off a lot.
- Never releases, holds or changes a shipment or lot status in the WMS.

`shelf_life_draft_disposition_request` writes a draft marked DRAFT; nothing goes out from it. Approving it (`shelf_life_request_send`) takes one click by a named person, even in Auto, and only records the approval: the agent itself sends, posts, files and pays nothing. What to change, send or pay is a person's decision.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `warn_days` | `60` | A lot expiring within this many days is listed as expiring soon |
| `default_min_days` | `0` | Shelf life a shipment must have left, for customers not named below |
| `customer_min_days` | `{}` | Minimum days of shelf life left at shipment, by customer |

<!-- generated:start -->

## A demo run

`npx -y fairmake-shelf-life demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Shelf Life demo: eight fictional lots and five shipments, as of 2026-11-18. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  8 lot(s) as of 2026-11-18: 720 expired on hand, 2 expiring soon. 3 to act on, 3 to review, 1 to watch, 1 fine.
    flag         L-2601                          expired_on_hand
    flag         L-2602                          expiring_soon, short_dated_shipment
    review       L-2603                          fefo_skipped
    review       L-2604                          no_expiry
    flag         L-2605                          shipped_expired
    watch        L-2607                          expiring_soon
    review       L-2608                          fefo_skipped

▶ Explain L-2602
  status: executed  decision: allow
  L-2602: flag. Lot L-2602 (ADH-10) expires 2026-12-15 (in 27 days) with 120 on hand. Shipment S-1 to Example Mart on 2026-11-05 carried lot L-2602 with 40 days left; the customer needs 90.

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Shelf life and expiry as of 2026-11-18 written: 8 lot(s) as of 2026-11-18: 720 expired on hand, 2 expiring soon. 3 to act on, 3 to review, 1 to watch, 1 fine.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  disposition request open drafted for 720 with 1 open marker(s) ([TO CONFIRM quality and inventory lead]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  disposition request open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries erp_scrap_inventory itself
  status: blocked  decision: block
  reason: Never scraps or writes off a lot.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `shelf_life_check` | For each lot: flags expired stock on hand, shipments made after expiry and shipments with fewer days left than the customer's minimum; reviews lots with no expiry date and shipments that took a newer lot while an olde… | runs |
| `shelf_life_explain` | Show one lot's figures and findings, from the same files as shelf_life_check. | runs |
| `shelf_life_write_report` | Write shelf-life.csv (one row per lot, with a blank decision column for people to fill in) and shelf-life.html, plus a calendar (.ics) of the due dates into out_dir (default fairmake-out/shelf-life). | runs |
| `shelf_life_draft_disposition_request` | Write drafts/disposition_request-open.md: expired and problem lots with the shipments involved, for quality and inventory to disposition. | asks first (Auto can be opted in) |
| `shelf_life_request_send` | After one named human click (even in Auto), record that the reviewed disposition request draft is approved in disposition_request-requests.csv. | one named click, even in Auto (`binding_send`) |
| `erp_scrap_inventory` | Never scraps or writes off a lot. | refused |
| `wms_release_shipment` | Never releases, holds or changes a shipment or lot status in the WMS. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Lots on hand (`lots`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `lot` (required) | text | Lot, Lot Number, Lot No., Batch, Batch Number | Charge, Lot, ロット, 批次 |
| `item` | text | Item, Part, Part Number, SKU, Product | Artikel, Article, 品目, 物料 |
| `location` | text | Location, Warehouse, Bin | Lagerort, Emplacement, 保管場所, 库位 |
| `on_hand` | number | On Hand, Qty, Quantity, Qty On Hand | Lagerbestand, Stock disponible, 在庫数, 现有库存 |
| `mfg_date` | date | Mfg Date, Manufacture Date, Production Date, Received Date | Herstelldatum, Date de fabrication, 製造日, 生产日期 |
| `expiry_date` | date | Expiry Date, Expiration Date, Expiration, Best Before, Use By | Mindesthaltbarkeitsdatum, Date de péremption, 賞味期限, 有效期 |
| `unit_cost` | amount | Unit Cost, Cost, Std Cost | Stückkosten, Coût unitaire, 単価, 单位成本 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| Fishbowl | Inventory by tracking (lot and expiration) export | Part Number, Lot Number, Expiration Date, Qty | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Shipments by lot (`shipments`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `shipment` (required) | text | Shipment, Shipment ID, Packing Slip, Delivery | - |
| `customer` | text | Customer, Ship To, Customer Name | Kunde, Client, 顧客, 客户 |
| `item` | text | Item, Part, Part Number, SKU | Artikel, Article, 品目, 物料 |
| `lot` | text | Lot, Lot Number, Batch | Charge, Lot, ロット, 批次 |
| `ship_date` | date | Ship Date, Shipped, Date | Versanddatum, Date d'expédition, 出荷日, 发货日期 |
| `qty` | number | Qty, Quantity, Qty Shipped | Menge, Quantité, 数量, 数量 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-shelf-life inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-shelf-life demo
npx -y fairmake-shelf-life mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-shelf-life": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-shelf-life",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-shelf-life -- npx -y fairmake-shelf-life mcp --root .`, or install the `fairmake-shelf-life` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-shelf-life approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-shelf-life approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-shelf-life kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-shelf-life tools                 # every tool, its policy and arguments
fairmake-shelf-life sources               # the columns each input is read from
fairmake-shelf-life inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-shelf-life call shelf_life_check '{"lots":"<lots>"}'
fairmake-shelf-life eval                  # the private eval cases on the fictional fixtures
fairmake-shelf-life demo
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
