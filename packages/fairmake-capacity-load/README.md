# Fairmake Capacity Load

`fairmake-capacity-load` · MCP server and CLI · MIT

Open operation hours by work center and week against available hours, overloaded weeks, past-due load and work centers with no calendar. Reschedules nothing.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

Put each open operation's remaining hours in the week of its due date (past-due ones in the first week) and compare each week with the work center's available hours (hours per day times days per week times efficiency). Flags overloaded weeks, lists weeks near capacity, reviews past-due load and work centers with no calendar.

| Finding | Example from the fictional demo data |
|---|---|
| `near_capacity` | CNC is near capacity in 2026-11-30 (91.2%). |
| `no_calendar` | SAW has 6 open hours and no working calendar, so its load cannot be compared. |
| `overloaded_week` | CNC is loaded past 100% in 1 week(s): 2026-11-16 75/68 h (110.3%). |
| `past_due_load` | 1 operation(s) on WELD were due before this week (12 h); they are loaded into the week of 2026-11-16. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## What it needs, and what stays with a person

- `operations` (required): Open work order operations under --root: work order, operation, work center, due date and hours remaining
- `calendar` (required): Work center calendar under --root: hours per day, days per week and efficiency %
- `as_of` (optional): Start of the horizon, YYYY-MM-DD (default today); loading starts on the Monday of that week
- `settings` (optional): settings JSON under --root; anything left out uses the defaults listed in the result as settings_used

It never does these, and any other tool name is blocked:

- Never reschedules work orders or operations in the ERP.
- Never sends new promise dates to customers.

`capacity_draft_capacity_review` writes a draft marked DRAFT; nothing goes out from it. Approving it (`capacity_request_send`) takes one click by a named person, even in Auto, and only records the approval: the agent itself sends, posts, files and pays nothing. What to change, send or pay is a person's decision.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `weeks` | `6` | Weeks ahead to load, starting with the week of as_of |
| `overload_pct` | `100` | A week loaded above this percentage of available hours is overloaded |
| `watch_pct` | `90` | A week above this percentage is listed to watch |

<!-- generated:start -->

## A demo run

`npx -y fairmake-capacity-load demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Capacity Load demo: fictional open operations on five work centers, six weeks from 2026-11-16. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  5 work center(s), 265 open hours, 2026-11-16 to 2026-12-27: 1 overloaded, 2 to review, 0 near capacity, 2 with room.
    flag         CNC                             overloaded_week, near_capacity
    review       SAW                             no_calendar
    review       WELD                            past_due_load

▶ Explain CNC
  status: executed  decision: allow
  CNC: flag. CNC is loaded past 100% in 1 week(s): 2026-11-16 75/68 h (110.3%). CNC is near capacity in 2026-11-30 (91.2%).

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Capacity load against available hours written: 5 work center(s), 265 open hours, 2026-11-16 to 2026-12-27: 1 overloaded, 2 to review, 0 near capacity, 2 with room.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  capacity review open drafted with 1 open marker(s) ([TO CONFIRM production planner]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  capacity review open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries erp_reschedule_orders itself
  status: blocked  decision: block
  reason: Never reschedules work orders or operations in the ERP.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `capacity_check` | Put each open operation's remaining hours in the week of its due date (past-due ones in the first week) and compare each week with the work center's available hours (hours per day times days per week times efficiency). | runs |
| `capacity_explain` | Show one work center's figures and findings, from the same files as capacity_check. | runs |
| `capacity_write_report` | Write capacity-load.csv (one row per work center, with a blank decision column for people to fill in) and capacity-load.html into out_dir (default fairmake-out/capacity). | runs |
| `capacity_draft_capacity_review` | Write drafts/capacity_review-open.md: the overloaded and near-capacity work centers with their weeks, for the production planner to decide on overtime, shifts or new dates. | asks first (Auto can be opted in) |
| `capacity_request_send` | After one named human click (even in Auto), record that the reviewed capacity review draft is approved in capacity_review-requests.csv. | one named click, even in Auto (`binding_send`) |
| `erp_reschedule_orders` | Never reschedules work orders or operations in the ERP. | refused |
| `customer_promise_send` | Never sends new promise dates to customers. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Open operations (`operations`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `work_order` (required) | text | Work Order, Job, WO, Production Order | Fertigungsauftrag, Ordre de fabrication, 製造指図, 生产工单 |
| `operation` | text | Operation, Oper Num, Op, Step | Arbeitsgang, Opération, 工程, 工序 |
| `work_center` (required) | text | Work Center, Work Centre, Resource, Machine | Arbeitsplatz, Poste de charge, 作業区, 工作中心 |
| `due_date` | date | Due Date, Op Due Date, Scheduled Finish, Need Date, End Date | Fälligkeitsdatum, Date d'échéance, 期日, 截止日期 |
| `hours_remaining` | number | Hours Remaining, Remaining Hours, Open Hours, Load Hours, Run Hours Remaining | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked |
|---|---|---|---|
| Infor CloudSuite Industrial (SyteLine) | Job operations list export | Job, Oper Num, Work Center, Hours Remaining | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date; where it says "tested", an agent was run on a real published file in that layout. The other layouts were written from knowledge of the export and were not checked. None was tested against a customer's live account.

### Work center calendar (`calendar`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `work_center` (required) | text | Work Center, Work Centre, Resource, Machine | Arbeitsplatz, Poste de charge, 作業区, 工作中心 |
| `hours_per_day` | number | Hours per Day, Shift Hours, Daily Hours | - |
| `days_per_week` | number | Days per Week, Working Days, Days | - |
| `efficiency_pct` | number | Efficiency %, Efficiency, Utilization % | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-capacity-load inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-capacity-load demo
npx -y fairmake-capacity-load mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-capacity-load": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-capacity-load",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-capacity-load -- npx -y fairmake-capacity-load mcp --root .`, or install the `fairmake-capacity-load` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-capacity-load approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-capacity-load approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-capacity-load kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-capacity-load tools                 # every tool, its policy and arguments
fairmake-capacity-load sources               # the columns each input is read from
fairmake-capacity-load inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-capacity-load call capacity_check '{"operations":"<operations>","calendar":"<calendar>"}'
fairmake-capacity-load eval                  # the private eval cases on the fictional fixtures
fairmake-capacity-load demo
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
