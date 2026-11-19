# Fairmake Overhead Absorption

`fairmake-overhead-absorption` · MCP server and CLI · MIT

Overhead applied to jobs (hours times rate) against overhead spent, by work center, with proposed rates. Posts nothing.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

For each work center, multiply the hours worked on jobs by the overhead rate and compare with the overhead actually spent. Flags under-absorption past the tolerance, lists over-absorption and hours well below budget, and reviews work centers with hours but no rate or no actual spend. Proposes a rate from actual spend and hours.

| Finding | Example from the fictional demo data |
|---|---|
| `low_volume` | CNC ran 650 hours against 800 budgeted (-18.7%): fixed overhead is spread over fewer hours. |
| `no_actual` | SAW applied 4000 but has no actual overhead in the file. |
| `no_rate` | ASSY has 500 hours and no overhead rate, so none of its 9000 overhead was applied to jobs. |
| `over_absorbed` | PAINT: 8000 applied against 6800 spent: 1200 over-absorbed (17.6%). Jobs through it are over-costed. |
| `under_absorbed` | CNC: 36000 spent, 29250 applied (650 h at 45): 6750 under-absorbed (18.8%). Jobs through it are under-costed. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## What it needs, and what stays with a person

- `hours` (required): Hours worked on jobs by work center under --root (labor or machine hours, one or many rows per work center)
- `rates` (required): Overhead rates under --root: work center, rate per hour and optional budget hours
- `actuals` (required): Actual overhead spend by work center (or cost center) under --root
- `settings` (optional): settings JSON under --root; anything left out uses the defaults listed in the result as settings_used

It never does these, and any other tool name is blocked:

- Never posts the under- or over-absorption journal.
- Never changes overhead or burden rates in the ERP.

`absorption_draft_rate_change` writes a draft marked DRAFT; nothing goes out from it. Approving it (`absorption_request_apply`) takes one click by a named person, even in Auto, and only records the approval: the agent itself sends, posts, files and pays nothing. What to change, send or pay is a person's decision.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `tolerance_pct` | `5` | Under- or over-absorption beyond this percentage of actual overhead is reported |
| `volume_pct` | `15` | Hours this far below budget hours are listed as a volume shortfall |

<!-- generated:start -->

## A demo run

`npx -y fairmake-overhead-absorption demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Overhead Absorption demo: six fictional work centers over October and November 2026. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  6 work center(s): 54975 applied against 65650 spent (net 10675 under-absorbed). 1 under-absorbed past tolerance, 2 to review, 1 to watch, 2 in line.
    review       ASSY                            no_rate
    flag         CNC                             under_absorbed, low_volume
    watch        PAINT                           over_absorbed
    review       SAW                             no_actual

▶ Explain CNC
  status: executed  decision: allow
  CNC: flag. CNC: 36000 spent, 29250 applied (650 h at 45): 6750 under-absorbed (18.8%). Jobs through it are under-costed. CNC ran 650 hours against 800 budgeted (-18.7%): fixed overhead is spread over fewer hours.

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Overhead absorption written: 6 work center(s): 54975 applied against 65650 spent (net 10675 under-absorbed). 1 under-absorbed past tolerance, 2 to review, 1 to watch, 2 in line.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  rate change proposal drafted with 1 open marker(s) ([TO CONFIRM controller who sets overhead rates]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: production_deploy stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  rate change proposal approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries erp_post_journal itself
  status: blocked  decision: block
  reason: Never posts the under- or over-absorption journal.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `absorption_check` | For each work center, multiply the hours worked on jobs by the overhead rate and compare with the overhead actually spent. | runs |
| `absorption_explain` | Show one work center's figures and findings, from the same files as absorption_check. | runs |
| `absorption_write_report` | Write overhead-absorption.csv (one row per work center, with a blank decision column for people to fill in) and overhead-absorption.html into out_dir (default fairmake-out/absorption). | runs |
| `absorption_draft_rate_change` | Write drafts/rate_change-proposal.md: the proposed overhead rate for every work center under- or over-absorbed past the tolerance. | asks first (Auto can be opted in) |
| `absorption_request_apply` | After one named human click (even in Auto), record that the reviewed rate change draft is approved in rate_change-requests.csv. | one named click, even in Auto (`production_deploy`) |
| `erp_post_journal` | Never posts the under- or over-absorption journal. | refused |
| `erp_update_overhead_rates` | Never changes overhead or burden rates in the ERP. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Hours by work center (`hours`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `work_center` (required) | text | Work Center, Work Centre, WC, Resource, Department, Resource Group | Arbeitsplatz, Poste de charge, 作業区, 工作中心 |
| `period` | text | Period, Month, Fiscal Period | - |
| `hours` | number | Hours, Actual Hours, Act Run Hrs, Run Hours, Labor Hours, Machine Hours | Stunden, Heures, 時間, 工时 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| JobBOSS | Labor hours by work center (CSV) | Work Center, Period, Act Run Hrs | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Overhead rates (`rates`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `work_center` (required) | text | Work Center, Work Centre, WC, Resource, Department | Arbeitsplatz, Poste de charge, 作業区, 工作中心 |
| `rate` | amount | Rate, Overhead Rate, Burden Rate, Overhead per Hour | Frachtrate, Tarif, 料率, 运价 |
| `budget_hours` | number | Budget Hours, Planned Hours, Normal Hours, Capacity Hours | - |

### Actual overhead (`actuals`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `work_center` (required) | text | Work Center, Work Centre, WC, Cost Center, Department | Arbeitsplatz, Poste de charge, 作業区, 工作中心 |
| `period` | text | Period, Month, Fiscal Period | - |
| `actual_overhead` | amount | Actual Overhead, Overhead, Amount, Actual, Spend | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-overhead-absorption inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-overhead-absorption demo
npx -y fairmake-overhead-absorption mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-overhead-absorption": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-overhead-absorption",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-overhead-absorption -- npx -y fairmake-overhead-absorption mcp --root .`, or install the `fairmake-overhead-absorption` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-overhead-absorption approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-overhead-absorption approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-overhead-absorption kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-overhead-absorption tools                 # every tool, its policy and arguments
fairmake-overhead-absorption sources               # the columns each input is read from
fairmake-overhead-absorption inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-overhead-absorption call absorption_check '{"hours":"<hours>","rates":"<rates>","actuals":"<actuals>"}'
fairmake-overhead-absorption eval                  # the private eval cases on the fictional fixtures
fairmake-overhead-absorption demo
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
