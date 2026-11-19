# Fairmake HTS Codes

`fairmake-hts-codes` · MCP server and CLI · MIT

Tariff codes and countries of origin checked for gaps, format and consistency with your own code list and with customs entry lines. No classification advice; files nothing.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

Flags items with no tariff code, entry lines declared under another code than the item master and duty rates that differ from your own list; reviews malformed codes, codes not in your list, missing or conflicting origins; lists items with the same description under different headings. It compares your own records only.

| Finding | Example from the fictional demo data |
|---|---|
| `duty_rate_differs` | Entry line E3-1: duty 2.5% on 8413.91.9095, your list says 0% (250 on 10000 entered value, possibly overpaid). |
| `entry_coo_differs` | Entry line E2-2 declared origin CN; the item master says JP. |
| `entry_hts_differs` | Entry line E2-1 declared NUT-M8 under 7318.15.2065; the item master says 7318.16.0085. |
| `hts_format` | GSK-220 has tariff code "8484.9", which is not 6, 8 or 10 digits. |
| `hts_not_in_list` | SEAL-10 uses 401693, which is not in your list of codes. |
| `missing_coo` | SEAL-10 has no country of origin. |
| `missing_hts` | CAS-310 has no tariff code in the item master. |
| `same_description_split` | BOLT-M8 and BOLT-M8-ZP share the description "Hex bolt M8 steel" but sit under different headings (7318.15.2065 and 7318.16.0085). |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `codes` | `{}` | Your own list of tariff codes in use (from your broker or classification file), with the duty % you expect for each |

<!-- generated:start -->

## A demo run

`npx -y fairmake-hts-codes demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake HTS Codes demo: nine fictional items and six fictional entry lines. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  9 item(s), 6 entry line(s): 3 with a missing or conflicting code or duty, 3 to check, 2 to watch, 1 consistent; duty differences 250. 1 entered item(s) not in the item master.
    watch        BOLT-M8                         same_description_split
    watch        BOLT-M8-ZP                      same_description_split
    review       BRG-6204                        entry_coo_differs
    flag         CAS-310                         missing_hts
    review       GSK-220                         hts_format
    flag         HSG-300                         duty_rate_differs
    flag         NUT-M8                          entry_hts_differs
    review       SEAL-10                         hts_not_in_list, missing_coo

▶ Explain BOLT-M8
  status: executed  decision: allow
  BOLT-M8: watch. BOLT-M8 and BOLT-M8-ZP share the description "Hex bolt M8 steel" but sit under different headings (7318.15.2065 and 7318.16.0085).

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Tariff code consistency written: 9 item(s), 6 entry line(s): 3 with a missing or conflicting code or duty, 3 to check, 2 to watch, 1 consistent; duty differences 250. 1 entered item(s) not in the item master.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  broker query open drafted for 250 with 1 open marker(s) ([TO CONFIRM customs broker contact]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  broker query open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries customs_filing_submit itself
  status: blocked  decision: block
  reason: Never files or amends a customs entry or a post-summary correction.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `hts_check` | Flags items with no tariff code, entry lines declared under another code than the item master and duty rates that differ from your own list; reviews malformed codes, codes not in your list, missing or conflicting orig… | runs |
| `hts_explain` | Show one item's figures and findings, from the same files as hts_check. | runs |
| `hts_write_report` | Write hts-codes.csv (one row per item, with a blank decision column for people to fill in) and hts-codes.html into out_dir (default fairmake-out/hts). | runs |
| `hts_draft_broker_query` | Write drafts/broker_query-open.md: every item whose code, origin or duty conflicts, as questions for the customs broker. | asks first (Auto can be opted in) |
| `hts_request_send` | After one named human click (even in Auto), record that the reviewed broker query draft is approved in broker_query-requests.csv. | one named click, even in Auto (`binding_send`) |
| `customs_filing_submit` | Never files or amends a customs entry or a post-summary correction. | refused |
| `erp_write_item_master` | Never changes tariff codes or origins in the item master. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Item master (`items`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `item` (required) | text | Item, Part, Part Number, Inventory ID, SKU, Item No. | Artikel, Article, 品目, 物料 |
| `description` | text | Description, Item Description, Name | Beschreibung, Description, 摘要, 摘要 |
| `hts_code` | text | HTS Code, HTS, Tariff Code, HS Code, Harmonized Code, Commodity Code | Zolltarifnummer, Code SH, HSコード, HS编码 |
| `country_of_origin` | text | Country of Origin, COO, Origin, Origin Country | Ursprungsland, Pays d'origine, 原産国, 原产国 |
| `supplier` | text | Supplier, Vendor, Preferred Vendor | Lieferant, Fournisseur, 仕入先, 供应商 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| Acumatica | Stock items (IN202500) list export | Inventory ID, Description, Tariff Code, Country of Origin | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Customs entry lines (`entries`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `entry_line` (required) | text | Entry Line, Entry Line ID, Line ID | - |
| `item` | text | Item, Part, Part Number, Part No. | Artikel, Article, 品目, 物料 |
| `hts_code` | text | HTS Code, HTS, Tariff Number, HS Code | Zolltarifnummer, Code SH, HSコード, HS编码 |
| `country_of_origin` | text | Country of Origin, COO, Origin | Ursprungsland, Pays d'origine, 原産国, 原产国 |
| `duty_rate` | number | Duty Rate, Duty %, Rate %, Ad Valorem Rate | Zollsatz, Taux de droit, 関税率, 关税税率 |
| `entered_value` | amount | Entered Value, Value, Customs Value | Zollwert, Valeur en douane, 課税価格, 完税价格 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-hts-codes inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-hts-codes demo
npx -y fairmake-hts-codes mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-hts-codes": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-hts-codes",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-hts-codes -- npx -y fairmake-hts-codes mcp --root .`, or install the `fairmake-hts-codes` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-hts-codes approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-hts-codes approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-hts-codes kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-hts-codes tools                 # every tool, its policy and arguments
fairmake-hts-codes sources               # the columns each input is read from
fairmake-hts-codes inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-hts-codes call hts_check '{"items":"<items>"}'
fairmake-hts-codes eval                  # the private eval cases on the fictional fixtures
fairmake-hts-codes demo
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
