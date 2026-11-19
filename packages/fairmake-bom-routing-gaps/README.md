# fairmake-bom-routing-gaps

Made items with no BOM or routing, inactive or unknown components, zero quantities, routing steps with no work center or time, and BOM loops. Edits nothing.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

For every made item and every item with a BOM: flags no BOM, no routing, inactive components, zero quantities and loops; reviews components or parents missing from the item master and routing steps with no work center or no time; lists bought items carrying a BOM.

| Finding | Example from the fictional demo data |
|---|---|
| `buy_with_bom` | SEAL-10 is a bought item but has a BOM; check the make/buy setting. |
| `circular_bom` | The BOM of LOOP-A loops: LOOP-A > LOOP-B > LOOP-A. |
| `component_inactive` | Component OLD-BRKT of FRAME-20 is obsolete. |
| `component_unknown` | Component WHEEL-X of CART-50 is not in the item master. |
| `no_bom` | GUARD-30 is a made item with no bill of materials: a work order for it would issue no material. |
| `no_routing` | PANEL-40 is a made item with no routing: no labor or machine time would be planned or costed. |
| `parent_unknown` | KIT-60 has a BOM but is not in the item master. |
| `routing_no_time` | Operation 10 of CART-50 has no setup or run time. |
| `routing_no_work_center` | Operation 20 of FRAME-20 has no work center. |
| `zero_qty` | Component BOLT-M8 of FRAME-20 has quantity 0. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `note` | `` | Free text for your own records |
| `make_words` | `["make","manufactured","assembly","subassembly","produced"]` | Item type words that mean the item is made in house (needs a BOM and a routing) |
| `buy_words` | `["buy","purchased","purchase","bought"]` | Item type words that mean the item is bought (should not carry a BOM) |
| `inactive_words` | `["obsolete","inactive","discontinued","blocked","no","false"]` | Status words that mean an item is no longer used |

<!-- generated:start -->

## A demo run

`npx -y fairmake-bom-routing-gaps demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake BOM Routing Gaps demo: a fictional item master with nine made items. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  9 made or structured item(s) checked: 5 cannot be built or costed as set up, 2 to review, 1 to watch, 1 complete.
    review       CART-50                         component_unknown, routing_no_time
    flag         FRAME-20                        zero_qty, component_inactive, routing_no_work_center
    flag         GUARD-30                        no_bom
    review       KIT-60                          parent_unknown
    flag         LOOP-A                          circular_bom
    flag         LOOP-B                          circular_bom
    flag         PANEL-40                        no_routing
    watch        SEAL-10                         buy_with_bom

▶ Explain FRAME-20
  status: executed  decision: allow
  FRAME-20: flag. Component BOLT-M8 of FRAME-20 has quantity 0. Component OLD-BRKT of FRAME-20 is obsolete. Operation 20 of FRAME-20 has no work center.

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  BOM and routing completeness written: 9 made or structured item(s) checked: 5 cannot be built or costed as set up, 2 to review, 1 to watch, 1 complete.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  master data fix open drafted with 1 open marker(s) ([TO CONFIRM engineering or ERP data owner]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: production_deploy stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  master data fix open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries erp_write_bom itself
  status: blocked  decision: block
  reason: Never creates or edits BOMs, routings or items in the ERP.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `bom_gaps_check` | For every made item and every item with a BOM: flags no BOM, no routing, inactive components, zero quantities and loops; reviews components or parents missing from the item master and routing steps with no work center… | runs |
| `bom_gaps_explain` | Show one item's figures and findings, from the same files as bom_gaps_check. | runs |
| `bom_gaps_write_report` | Write bom-routing-gaps.csv (one row per item, with a blank decision column for people to fill in) and bom-routing-gaps.html into out_dir (default fairmake-out/bom-gaps). | runs |
| `bom_gaps_draft_master_data_fix` | Write drafts/master_data_fix-open.md: every item that cannot be built or costed as set up, with the fix needed. | asks first (Auto can be opted in) |
| `bom_gaps_request_apply` | After one named human click (even in Auto), record that the reviewed master data fix draft is approved in master_data_fix-requests.csv. | one named click, even in Auto (`production_deploy`) |
| `erp_write_bom` | Never creates or edits BOMs, routings or items in the ERP. | refused |
| `erp_release_work_order` | Never releases or schedules a work order. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Item master (`items`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `item` (required) | text | Item, Part, Part Number, Item No., SKU, Product | Artikel, Article, 品目, 物料 |
| `item_type` | text | Type, Item Type, Make/Buy, Procurement, Source, Part Type | - |
| `item_status` | text | Status, Item Status, Active, Lifecycle | - |

### Bill of materials (`bom`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `parent` (required) | text | Parent, Parent Item, Assembly, Product, BOM Item | Baugruppe, Article parent, 親品目, 父项 |
| `component` (required) | text | Component, Component Item, Child, Part number, Material | Komponente, Composant, 子品目, 子项 |
| `qty_per` | number | Qty Per, Quantity Per, Quantity, Qty | Menge je, Quantité par, 員数, 单位用量 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| MRPeasy | Bills of materials export | BOM number, Product, Part number, Quantity | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Routings (`routings`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `item` (required) | text | Item, Part, Product, Assembly, Part Number | Artikel, Article, 品目, 物料 |
| `operation` | text | Operation, Op, Oper Num, Step, Sequence | Arbeitsgang, Opération, 工程, 工序 |
| `work_center` | text | Work Center, Work Centre, Resource, Workstation | Arbeitsplatz, Poste de charge, 作業区, 工作中心 |
| `setup_hours` | number | Setup Hours, Setup Hrs, Setup Time | - |
| `run_hours` | number | Run Hours, Run Hrs, Run Time, Hours per Unit, Cycle Time | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-bom-routing-gaps inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-bom-routing-gaps demo
npx -y fairmake-bom-routing-gaps mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-bom-routing-gaps": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-bom-routing-gaps",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-bom-routing-gaps -- npx -y fairmake-bom-routing-gaps mcp --root .`, or install the `fairmake-bom-routing-gaps` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-bom-routing-gaps approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-bom-routing-gaps approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-bom-routing-gaps kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-bom-routing-gaps tools                 # every tool, its policy and arguments
fairmake-bom-routing-gaps sources               # the columns each input is read from
fairmake-bom-routing-gaps inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-bom-routing-gaps call bom_gaps_check '{"items":"<items>","bom":"<bom>","routings":"<routings>"}'
fairmake-bom-routing-gaps eval                  # the private eval cases on the fictional fixtures
fairmake-bom-routing-gaps demo
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
