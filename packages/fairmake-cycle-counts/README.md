# fairmake-cycle-counts

Counted against system quantity with tolerances by ABC class, repeat variances, lines not counted and accuracy by class, with an adjustment list for approval. Posts nothing.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

For each count line, compare counted with system quantity. Flags variances over the class tolerance % and over the value floor; reviews lines with no count and negative system stock; lists items with a variance on several counts. Returns accuracy and variance value by ABC class.

| Finding | Example from the fictional demo data |
|---|---|
| `negative_system` | SEAL-10 at C-02 shows -12 on hand in the system. |
| `not_counted` | CC-1006 (PLT-A36 at B-03) has no counted quantity. |
| `out_of_tolerance` | CAS-310 at A-02: counted 36 against 40 (-4, -10%, -340); class A tolerance 2%. |
| `repeat_variance` | BAR-4140 has a variance on 2 counts: look for a process cause (unit of measure, backflush, receiving). |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `note` | `` | Free text for your own records |
| `tolerance_pct` | `{"A":2,"B":5,"C":10}` | Quantity tolerance % by ABC class |
| `default_tolerance_pct` | `5` | Tolerance % for items with no class |
| `value_tolerance` | `100` | A variance worth less than this is within tolerance whatever its % |
| `repeat_count` | `2` | An item with a variance on this many counts is a repeat variance |

<!-- generated:start -->

## A demo run

`npx -y fairmake-cycle-counts demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Cycle Counts demo: twelve fictional count lines across A, B and C items. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  12 count line(s), 11 counted: accuracy 72.7%, net variance -812.6, 931 out of tolerance on 3 line(s), 2 to review, 1 repeat variances.
    flag         CC-1002                         out_of_tolerance
    flag         CC-1003                         out_of_tolerance, repeat_variance
    review       CC-1006                         not_counted
    review       CC-1007                         negative_system
    flag         CC-1008                         out_of_tolerance
    watch        CC-1009                         repeat_variance

▶ Explain CC-1003
  status: executed  decision: allow
  CC-1003: flag. BAR-4140 at B-10: counted 1100 against 1200 (-100, -8.3%, -480); class B tolerance 5%. BAR-4140 has a variance on 2 counts: look for a process cause (unit of measure, backflush, receiving).

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Cycle count variance written: 12 count line(s), 11 counted: accuracy 72.7%, net variance -812.6, 931 out of tolerance on 3 line(s), 2 to review, 1 repeat variances.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  inventory adjustment open drafted for 931 with 1 open marker(s) ([TO CONFIRM controller or inventory manager]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: move_money stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  inventory adjustment open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries erp_post_inventory_adjustment itself
  status: blocked  decision: block
  reason: Never posts inventory adjustments or write-offs.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `counts_check` | For each count line, compare counted with system quantity. | runs |
| `counts_explain` | Show one count line's figures and findings, from the same files as counts_check. | runs |
| `counts_write_report` | Write cycle-counts.csv (one row per count line, with a blank decision column for people to fill in) and cycle-counts.html into out_dir (default fairmake-out/counts). | runs |
| `counts_draft_inventory_adjustment` | Write drafts/inventory_adjustment-open.md: the count lines out of tolerance with quantity and value, to be recounted and then approved. | asks first (Auto can be opted in) |
| `counts_request_approve` | After one named human click (even in Auto), record that the reviewed inventory adjustment draft is approved in inventory_adjustment-requests.csv. | one named click, even in Auto (`move_money`) |
| `erp_post_inventory_adjustment` | Never posts inventory adjustments or write-offs. | refused |
| `wms_move_stock` | Never moves stock between bins or changes the WMS. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Cycle count results (`counts`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `count_id` (required) | text | Count ID, Count Line, Tag, Count Tag, Line ID | - |
| `item` (required) | text | Item, Part, Part Number, SKU, Item No. | Artikel, Article, 品目, 物料 |
| `location` | text | Location, Bin, Warehouse, Bin Location | Lagerort, Emplacement, 保管場所, 库位 |
| `count_date` | date | Count Date, Date Counted, Date | Datum, Date, 日付, 日期 |
| `system_qty` | number | System Qty, Qty On Hand, Book Qty, Expected Qty, On Hand | Bestand, Stock, 在庫数, 库存数量 |
| `counted_qty` | number | Counted Qty, Qty Counted, Count, Physical Qty | Gezählt, Quantité comptée, 実棚数, 盘点数量 |
| `unit_cost` | amount | Unit Cost, Cost, Std Cost, Average Cost | Stückkosten, Coût unitaire, 単価, 单位成本 |
| `abc_class` | text | ABC Class, ABC, Class, Cycle Count Class | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| Fishbowl | Cycle count export | Part Number, Location, Qty On Hand, Qty Counted | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-cycle-counts inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-cycle-counts demo
npx -y fairmake-cycle-counts mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-cycle-counts": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-cycle-counts",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-cycle-counts -- npx -y fairmake-cycle-counts mcp --root .`, or install the `fairmake-cycle-counts` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-cycle-counts approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-cycle-counts approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-cycle-counts kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-cycle-counts tools                 # every tool, its policy and arguments
fairmake-cycle-counts sources               # the columns each input is read from
fairmake-cycle-counts inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-cycle-counts call counts_check '{"counts":"<counts>"}'
fairmake-cycle-counts eval                  # the private eval cases on the fictional fixtures
fairmake-cycle-counts demo
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
