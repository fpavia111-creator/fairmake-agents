# Fairmake Reorder Points

`fairmake-reorder-points` · MCP server and CLI · MIT

Stockouts, stock under safety stock, items at the reorder point, and reorder points that no longer fit usage and lead time. Places no order.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

For each item: available = on hand + on order - allocated. Flags stockouts and free stock under safety stock; lists items at or under their reorder point; with usage history, reviews reorder points more than the threshold away from daily usage times lead time plus safety stock, and items with no reorder point.

| Finding | Example from the fictional demo data |
|---|---|
| `at_reorder_point` | BAR-4140: 1500 available (on hand plus on order less allocated) is at or under the reorder point 1500. Order now. |
| `below_safety_stock` | SEAL-10: 150 free stock against safety stock 200 (200 on order). |
| `no_rop` | PLT-A36 has no reorder point. |
| `rop_stale` | BAR-4140: reorder point 1500, but 50 a day over 90 days times 28 days lead time plus safety stock 500 gives 1900. |
| `stockout` | BRG-6204: 50 on hand, 60 allocated, 0 on order: nothing available (-10). |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `lookback_days` | `90` | Days of usage history to average |
| `review_pct` | `25` | A reorder point this far from usage times lead time plus safety stock is listed for review |

<!-- generated:start -->

## A demo run

`npx -y fairmake-reorder-points demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Reorder Points demo: eight fictional items and 90 days of usage, as of 2026-11-18. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  8 item(s) as of 2026-11-18: 1 stocked out, 3 to order, 2 short, 4 with reorder points to review, 0 at the reorder point, 2 fine.
    review       BAR-4140                        at_reorder_point, rop_stale
    flag         BRG-6204                        stockout, rop_stale
    review       CAS-310                         rop_stale
    review       GSK-220                         rop_stale
    review       PLT-A36                         no_rop
    flag         SEAL-10                         below_safety_stock, at_reorder_point

▶ Explain BRG-6204
  status: executed  decision: allow
  BRG-6204: flag. BRG-6204: 50 on hand, 60 allocated, 0 on order: nothing available (-10). BRG-6204: reorder point 300, but 20 a day over 90 days times 14 days lead time plus safety stock 100 gives 380.

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Safety stock and reorder points written: 8 item(s) as of 2026-11-18: 1 stocked out, 3 to order, 2 short, 4 with reorder points to review, 0 at the reorder point, 2 fine.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  rop change proposal drafted with 1 open marker(s) ([TO CONFIRM purchasing or planning lead]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: production_deploy stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  rop change proposal approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries erp_create_purchase_order itself
  status: blocked  decision: block
  reason: Never creates or releases a purchase order.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `reorder_check` | For each item: available = on hand + on order - allocated. | runs |
| `reorder_explain` | Show one item's figures and findings, from the same files as reorder_check. | runs |
| `reorder_write_report` | Write reorder-points.csv (one row per item, with a blank decision column for people to fill in) and reorder-points.html into out_dir (default fairmake-out/reorder). | runs |
| `reorder_draft_rop_change` | Write drafts/rop_change-proposal.md: the reorder points that no longer fit recent usage and lead time, with the proposed value. | asks first (Auto can be opted in) |
| `reorder_request_apply` | After one named human click (even in Auto), record that the reviewed rop change draft is approved in rop_change-requests.csv. | one named click, even in Auto (`production_deploy`) |
| `erp_create_purchase_order` | Never creates or releases a purchase order. | refused |
| `supplier_po_send` | Never sends an order to a supplier. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Stock status (`items`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `item` (required) | text | Item, Part, Part Number, Part No., SKU, Item No. | Artikel, Article, 品目, 物料 |
| `on_hand` | number | On Hand, In stock, Qty On Hand, Quantity | Lagerbestand, Stock disponible, 在庫数, 现有库存 |
| `on_order` | number | On Order, Expected, Incoming, Qty On Order | Bestellt, En commande, 発注残, 在途数量 |
| `allocated` | number | Allocated, Booked, Committed, Reserved | Reserviert, Réservé, 引当数, 已分配 |
| `safety_stock` | number | Safety Stock, Min Qty, Minimum | Sicherheitsbestand, Stock de sécurité, 安全在庫, 安全库存 |
| `reorder_point` | number | Reorder Point, ROP, Reorder Level | Meldebestand, Point de commande, 発注点, 再订货点 |
| `lead_time_days` | number | Lead Time Days, Lead time, Lead Time, Purchase Lead Time | Wiederbeschaffungszeit, Délai d’approvisionnement, リードタイム, 提前期 |
| `unit_cost` | amount | Unit Cost, Cost, Avg Cost | Stückkosten, Coût unitaire, 単価, 单位成本 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| MRPeasy | Stock items export | Part No., In stock, Reorder point | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Usage history (`usage`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `item` (required) | text | Item, Part, Part Number, SKU | Artikel, Article, 品目, 物料 |
| `usage_date` | date | Date, Usage Date, Issue Date, Transaction Date | - |
| `qty` | number | Qty, Quantity, Qty Used, Qty Issued | Menge, Quantité, 数量, 数量 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-reorder-points inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-reorder-points demo
npx -y fairmake-reorder-points mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-reorder-points": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-reorder-points",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-reorder-points -- npx -y fairmake-reorder-points mcp --root .`, or install the `fairmake-reorder-points` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-reorder-points approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-reorder-points approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-reorder-points kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-reorder-points tools                 # every tool, its policy and arguments
fairmake-reorder-points sources               # the columns each input is read from
fairmake-reorder-points inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-reorder-points call reorder_check '{"items":"<items>"}'
fairmake-reorder-points eval                  # the private eval cases on the fictional fixtures
fairmake-reorder-points demo
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
