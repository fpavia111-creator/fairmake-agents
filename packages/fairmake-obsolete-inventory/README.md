# fairmake-obsolete-inventory

Stock sorted into obsolete, slow-moving, excess and active by months since it moved and months of supply, inactive items with stock, and a reserve proposal. Scraps nothing.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

For each item on hand, find the last time it moved (used or sold) and its months of supply at the last 12 months' usage. Flags obsolete stock and inactive items with stock, reviews slow-moving stock and items with no movement data, lists excess stock. Proposes a reserve per bucket; lines below the minimum value get none.

| Finding | Example from the fictional demo data |
|---|---|
| `excess` | BAR-1018: 5000 on hand is 50 months of supply at 1200 a year; 2600 above 24 months. |
| `inactive_with_stock` | KIT-9 is discontinued in the item master and still holds 40 (480). |
| `no_movement_data` | SEAL-NEW: 200 on hand (240) and no movement dates or usage in the file. |
| `obsolete` | PLT-OLD: 10 on hand (30), no movement since 2024-01-01 (35 months). |
| `slow_moving` | GSK-220: 600 on hand (750), last moved 2026-04-01 (8 months). |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `note` | `` | Free text for your own records |
| `slow_months` | `6` | No movement for this many months makes stock slow-moving |
| `obsolete_months` | `12` | No movement for this many months (or never) makes stock obsolete |
| `excess_months` | `24` | Stock above this many months of supply (at the last 12 months' usage) is excess |
| `reserve_pct` | `{"obsolete":100,"slow":25,"excess":50}` | Proposed reserve % by bucket (obsolete, slow, excess) |
| `min_value` | `50` | Lines worth less than this get no reserve |

<!-- generated:start -->

## A demo run

`npx -y fairmake-obsolete-inventory demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Obsolete Inventory demo: ten fictional items aged as of 2026-11-30. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  10 item(s), 21330 on hand as of 2026-11-30: proposed reserve 7213.5. 4 obsolete or inactive, 2 slow or without movement data, 1 excess, 3 active.
    watch        BAR-1018                        excess
    review       GSK-220                         slow_moving
    flag         KIT-9                           inactive_with_stock
    flag         PLT-OLD                         obsolete
    review       SEAL-NEW                        no_movement_data
    flag         SPR-77                          obsolete
    flag         VLV-OLD                         obsolete

▶ Explain VLV-OLD
  status: executed  decision: allow
  VLV-OLD: flag. VLV-OLD: 120 on hand (4200), no movement since 2025-06-15 (17.5 months).

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Slow-moving and obsolete inventory as of 2026-11-30 written: 10 item(s), 21330 on hand as of 2026-11-30: proposed reserve 7213.5. 4 obsolete or inactive, 2 slow or without movement data, 1 excess, 3 active.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  reserve proposal open drafted for 7213.5 with 1 open marker(s) ([TO CONFIRM controller]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: move_money stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  reserve proposal open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries erp_scrap_inventory itself
  status: blocked  decision: block
  reason: Never scraps, writes off or disposes of stock.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `obsolete_check` | For each item on hand, find the last time it moved (used or sold) and its months of supply at the last 12 months' usage. | runs |
| `obsolete_explain` | Show one item's figures and findings, from the same files as obsolete_check. | runs |
| `obsolete_write_report` | Write obsolete-inventory.csv (one row per item, with a blank decision column for people to fill in) and obsolete-inventory.html into out_dir (default fairmake-out/obsolete). | runs |
| `obsolete_draft_reserve_proposal` | Write drafts/reserve_proposal-open.md: every item with a proposed reserve, its value, last movement and bucket. | asks first (Auto can be opted in) |
| `obsolete_request_approve` | After one named human click (even in Auto), record that the reviewed reserve proposal draft is approved in reserve_proposal-requests.csv. | one named click, even in Auto (`move_money`) |
| `erp_scrap_inventory` | Never scraps, writes off or disposes of stock. | refused |
| `erp_post_journal` | Never posts the reserve or any journal. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Inventory on hand (`inventory`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `item` (required) | text | Item, Part, Part Number, SKU, Item No., Inventory ID | Artikel, Article, 品目, 物料 |
| `description` | text | Description, Item Description, Name | Beschreibung, Description, 摘要, 摘要 |
| `on_hand` | number | On Hand, Qty On Hand, Quantity, In Stock | Lagerbestand, Stock disponible, 在庫数, 现有库存 |
| `unit_cost` | amount | Unit Cost, Avg Cost, Average Cost, Std Cost, Cost | Stückkosten, Coût unitaire, 単価, 单位成本 |
| `last_used` | date | Last Used, Last Issue, Last Consumed, Last Issue Date | Letzter Verbrauch, Dernière consommation, 最終出庫日, 最后领用日期 |
| `last_sold` | date | Last Sold, Last Sale, Last Shipped, Last Sale Date | - |
| `usage_12m` | number | Usage 12m, 12 Month Usage, Annual Usage, Qty Used 12 Months | - |
| `item_status` | text | Status, Item Status, Active | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| QuickBooks Enterprise | Inventory Valuation Detail report (CSV or Excel) | Item, On Hand, Avg Cost, Asset Value | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-obsolete-inventory inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-obsolete-inventory demo
npx -y fairmake-obsolete-inventory mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-obsolete-inventory": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-obsolete-inventory",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-obsolete-inventory -- npx -y fairmake-obsolete-inventory mcp --root .`, or install the `fairmake-obsolete-inventory` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-obsolete-inventory approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-obsolete-inventory approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-obsolete-inventory kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-obsolete-inventory tools                 # every tool, its policy and arguments
fairmake-obsolete-inventory sources               # the columns each input is read from
fairmake-obsolete-inventory inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-obsolete-inventory call obsolete_check '{"inventory":"<inventory>"}'
fairmake-obsolete-inventory eval                  # the private eval cases on the fictional fixtures
fairmake-obsolete-inventory demo
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
