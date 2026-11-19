# Fairmake Preventive Maintenance

`fairmake-preventive-maintenance` · MCP server and CLI · MIT

PM tasks overdue by date or run hours, due soon, never done or with no interval, with a due-date calendar. Opens nothing in the CMMS.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

For each PM task, work out the next due date from the last completion and the interval in days, and compare run hours since the last PM with the interval in hours. Flags overdue tasks, lists tasks due soon, reviews tasks never done or with no interval.

| Finding | Example from the fictional demo data |
|---|---|
| `due_soon` | CNC-1 Spindle lubrication is due 2026-12-01 (in 13 days). |
| `meter_overdue` | PRESS-1 Hydraulic oil change has run 1250 hours since its last PM against an interval of 1000. |
| `never_done` | WELD-1 Ground cable check has no completion on record. |
| `no_interval` | COMP-1 Air filter has no interval in days or hours, so it can never come due. |
| `overdue` | CNC-2 Way cover inspection was due 2026-10-15 (34 days ago); marked safety critical. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `due_soon_days` | `14` | A task due within this many days is listed as due soon |

<!-- generated:start -->

## A demo run

`npx -y fairmake-preventive-maintenance demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Preventive Maintenance demo: ten fictional PM tasks on six machines, as of 2026-11-18. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  10 PM task(s) on 6 asset(s) as of 2026-11-18: 2 overdue (1 safety critical), 2 to review, 3 due soon, 3 on schedule.
    watch        PM-101                          due_soon
    watch        PM-107                          due_soon
    flag         PM-102                          overdue
    review       PM-106                          no_interval
    watch        PM-103                          due_soon
    flag         PM-104                          meter_overdue
    review       PM-105                          never_done

▶ Explain PM-102
  status: executed  decision: allow
  PM-102: flag. CNC-2 Way cover inspection was due 2026-10-15 (34 days ago); marked safety critical.

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Preventive maintenance as of 2026-11-18 written: 10 PM task(s) on 6 asset(s) as of 2026-11-18: 2 overdue (1 safety critical), 2 to review, 3 due soon, 3 on schedule.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  pm work orders open drafted with 1 open marker(s) ([TO CONFIRM maintenance lead]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  pm work orders open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries cmms_close_work_order itself
  status: blocked  decision: block
  reason: Never opens, closes or signs off work orders in the CMMS.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `pm_check` | For each PM task, work out the next due date from the last completion and the interval in days, and compare run hours since the last PM with the interval in hours. | runs |
| `pm_explain` | Show one PM task's figures and findings, from the same files as pm_check. | runs |
| `pm_write_report` | Write preventive-maintenance.csv (one row per PM task, with a blank decision column for people to fill in) and preventive-maintenance.html, plus a calendar (.ics) of the due dates into out_dir (default fairmake-out/pm). | runs |
| `pm_draft_pm_work_orders` | Write drafts/pm_work_orders-open.md: overdue tasks (safety-critical first) and tasks to review, for the maintenance lead to schedule. | asks first (Auto can be opted in) |
| `pm_request_send` | After one named human click (even in Auto), record that the reviewed pm work orders draft is approved in pm_work_orders-requests.csv. | one named click, even in Auto (`binding_send`) |
| `cmms_close_work_order` | Never opens, closes or signs off work orders in the CMMS. | refused |
| `machine_release_to_production` | Never releases a machine back to production; a qualified person does. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### PM schedule (`schedule`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `task` (required) | text | Task, PM Task, Task ID, PM ID, Procedure | - |
| `asset` (required) | text | Asset, Machine, Equipment, Asset ID | Anlage, Équipement, 設備, 设备 |
| `description` | text | Description, Task Description, Procedure Name | Beschreibung, Description, 摘要, 摘要 |
| `interval_days` | number | Interval Days, Frequency (days), Frequency Days, Every (days) | Intervall (Tage), Périodicité (jours), 周期（日）, 周期（天） |
| `interval_hours` | number | Interval Hours, Run Hours Interval, Meter Interval | - |
| `last_done` | date | Last Done, Last Completed, Last Performed, Completed On | Zuletzt durchgeführt, Dernière réalisation, 前回実施日, 上次执行日期 |
| `hours_since` | number | Hours Since, Run Hours Since, Meter Since Last, Hours Since Last PM | - |
| `critical` | text | Critical, Safety Critical, Priority Critical | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| CMMS (generic) | Preventive maintenance schedule export | Asset, PM Task, Frequency (days), Last Completed | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### PM completions (`completions`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `task` (required) | text | Task, PM Task, Task ID, PM ID | - |
| `done_date` | date | Done Date, Completed, Completed On, Date | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-preventive-maintenance inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-preventive-maintenance demo
npx -y fairmake-preventive-maintenance mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-preventive-maintenance": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-preventive-maintenance",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-preventive-maintenance -- npx -y fairmake-preventive-maintenance mcp --root .`, or install the `fairmake-preventive-maintenance` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-preventive-maintenance approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-preventive-maintenance approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-preventive-maintenance kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-preventive-maintenance tools                 # every tool, its policy and arguments
fairmake-preventive-maintenance sources               # the columns each input is read from
fairmake-preventive-maintenance inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-preventive-maintenance call pm_check '{"schedule":"<schedule>"}'
fairmake-preventive-maintenance eval                  # the private eval cases on the fictional fixtures
fairmake-preventive-maintenance demo
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
