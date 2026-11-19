# Fairmake Machine Downtime

`fairmake-machine-downtime` · MCP server and CLI · MIT

Availability, MTTR and MTBF per machine from MES downtime exports, chronic stop reasons, and stops with no reason, no end or overlapping. Changes no schedule.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

Per machine: downtime and unplanned hours, availability against scheduled hours, MTTR and MTBF from unplanned stops. Flags availability below target; lists reasons that recur; reviews stops with no reason code, no end time, overlapping stops and machines with no scheduled hours. Totals by reason.

| Finding | Example from the fictional demo data |
|---|---|
| `chronic_reason` | CNC-2 stopped 3 times for "Spindle fault" (12 hours). |
| `low_availability` | CNC-2 lost 14 of 80 scheduled hours to unplanned stops: 82.5% available (target 85%). |
| `no_reason` | 1 stop(s) on CNC-2 have no reason code (E6). |
| `no_schedule` | LASER-1 has stops but no scheduled hours, so availability cannot be measured. |
| `open_event` | 1 stop(s) on WELD-1 have no end time (E10): still down, or the restart was not recorded. |
| `overlapping_events` | Stops overlap on PRESS-1 (E8/E9): the same downtime may be counted twice. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## What it needs, and what stays with a person

- `events` (required): Downtime events from an MES or machine monitoring export under --root: event, machine, start, end, reason and whether the stop was planned
- `schedule` (required): Scheduled production hours per machine for the same period under --root
- `settings` (optional): settings JSON under --root; anything left out uses the defaults listed in the result as settings_used

It never does these, and any other tool name is blocked:

- Never changes the production schedule or MES settings.
- Never opens or closes maintenance work orders in the CMMS; the maintenance lead does.

`downtime_draft_maintenance_request` writes a draft marked DRAFT; nothing goes out from it. Approving it (`downtime_request_send`) takes one click by a named person, even in Auto, and only records the approval: the agent itself sends, posts, files and pays nothing. What to change, send or pay is a person's decision.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `min_availability_pct` | `85` | A machine available less than this share of its scheduled hours (unplanned stops only) is flagged |
| `chronic_count` | `3` | An unplanned reason seen this many times on one machine is chronic |

<!-- generated:start -->

## A demo run

`npx -y fairmake-machine-downtime demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Machine Downtime demo: one fictional week of stops on five machines. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  5 machine(s), 11 stop(s): 19.5 unplanned hours of 340 scheduled (94.4% available). 1 below target, 3 with data to fix, 0 with chronic reasons, 1 fine.
    flag         CNC-2                           low_availability, chronic_reason, no_reason
    review       LASER-1                         no_schedule
    review       PRESS-1                         overlapping_events
    review       WELD-1                          open_event

▶ Explain CNC-2
  status: executed  decision: allow
  CNC-2: flag. CNC-2 lost 14 of 80 scheduled hours to unplanned stops: 82.5% available (target 85%). CNC-2 stopped 3 times for "Spindle fault" (12 hours). 1 stop(s) on CNC-2 have no reason code (E6).

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Machine downtime written: 5 machine(s), 11 stop(s): 19.5 unplanned hours of 340 scheduled (94.4% available). 1 below target, 3 with data to fix, 0 with chronic reasons, 1 fine.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  maintenance request open drafted with 1 open marker(s) ([TO CONFIRM maintenance lead]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  maintenance request open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries mes_change_schedule itself
  status: blocked  decision: block
  reason: Never changes the production schedule or MES settings.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `downtime_check` | Per machine: downtime and unplanned hours, availability against scheduled hours, MTTR and MTBF from unplanned stops. | runs |
| `downtime_explain` | Show one machine's figures and findings, from the same files as downtime_check. | runs |
| `downtime_write_report` | Write machine-downtime.csv (one row per machine, with a blank decision column for people to fill in) and machine-downtime.html into out_dir (default fairmake-out/downtime). | runs |
| `downtime_draft_maintenance_request` | Write drafts/maintenance_request-open.md: machines below the availability target or with chronic stop reasons, with MTTR and MTBF, for the maintenance lead. | asks first (Auto can be opted in) |
| `downtime_request_send` | After one named human click (even in Auto), record that the reviewed maintenance request draft is approved in maintenance_request-requests.csv. | one named click, even in Auto (`binding_send`) |
| `mes_change_schedule` | Never changes the production schedule or MES settings. | refused |
| `cmms_create_work_order` | Never opens or closes maintenance work orders in the CMMS; the maintenance lead does. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Downtime events (`events`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `event` (required) | text | Event, Event ID, Downtime ID, Stop ID, ID | Ereignis, Événement, 配送状況, 物流状态 |
| `machine` (required) | text | Machine, Asset, Equipment, Line, Work Center | Maschine, Machine, 設備, 设备 |
| `start` | date and time | Start, Start Time, Down Start, Stopped At, From | Beginn, Début, 開始, 开始时间 |
| `end` | date and time | End, End Time, Down End, Restarted At, To | Ende, Fin, 終了, 结束时间 |
| `reason` | text | Reason, Downtime Reason, Stop Reason, Reason Code, Cause | Grund, Motif, 理由, 原因 |
| `planned` | text | Planned, Planned Stop, Scheduled, Is Planned | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| MES (generic) | Downtime events export | Machine, Start Time, End Time, Downtime Reason | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Scheduled hours (`schedule`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `machine` (required) | text | Machine, Asset, Equipment, Line, Work Center | Maschine, Machine, 設備, 设备 |
| `scheduled_hours` | number | Scheduled Hours, Planned Production Time, Available Hours, Shift Hours | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-machine-downtime inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-machine-downtime demo
npx -y fairmake-machine-downtime mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-machine-downtime": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-machine-downtime",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-machine-downtime -- npx -y fairmake-machine-downtime mcp --root .`, or install the `fairmake-machine-downtime` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-machine-downtime approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-machine-downtime approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-machine-downtime kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-machine-downtime tools                 # every tool, its policy and arguments
fairmake-machine-downtime sources               # the columns each input is read from
fairmake-machine-downtime inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-machine-downtime call downtime_check '{"events":"<events>","schedule":"<schedule>"}'
fairmake-machine-downtime eval                  # the private eval cases on the fictional fixtures
fairmake-machine-downtime demo
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
