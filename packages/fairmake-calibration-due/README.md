# Fairmake Calibration Due

`fairmake-calibration-due` · MCP server and CLI · MIT

Gauges overdue or due soon, never calibrated, and work orders measured with a gauge that was overdue or had failed calibration, with a due-date calendar. Releases no hold.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

Work out each gauge's next calibration date from the last one and its interval. Flags overdue gauges, gauges used after a failed calibration and gauges used past their due date (naming the work orders); lists gauges due soon; reviews gauges never calibrated or with no interval. Out-of-service gauges are not chased for dates.

| Finding | Example from the fictional demo data |
|---|---|
| `due_soon` | HG-004 is due for calibration 2026-12-06 (in 18 days). |
| `failed_then_used` | MIC-002 failed its calibration on 2026-10-20 and was used afterwards on WO-301 (2026-11-02), WO-305 (2026-11-05). Review that product. |
| `never_calibrated` | PG-005 has no calibration on record. |
| `no_interval` | TW-006 has no calibration interval. |
| `overdue` | CAL-003 was due for calibration 2026-11-01 (17 days ago). |
| `used_while_overdue` | CAL-003 was used past its due date 2026-11-01 on WO-310 (2026-11-10). |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## What it needs, and what stays with a person

- `gauges` (required): Gauge or instrument register under --root: id, last calibration, interval in days, last result and status
- `usage` (optional): gauge use log under --root: gauge, work order or lot, and date used
- `as_of` (optional): Date to measure from, YYYY-MM-DD (default today)
- `settings` (optional): settings JSON under --root; anything left out uses the defaults listed in the result as settings_used

It never does these, and any other tool name is blocked:

- Never places or releases a quality hold in the QMS or ERP.
- Never notifies a customer about suspect product.

`calibration_draft_suspect_product_notice` writes a draft marked DRAFT; nothing goes out from it. Approving it (`calibration_request_send`) takes one click by a named person, even in Auto, and only records the approval: the agent itself sends, posts, files and pays nothing. What to change, send or pay is a person's decision.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `due_soon_days` | `30` | A gauge due within this many days is listed as due soon |

<!-- generated:start -->

## A demo run

`npx -y fairmake-calibration-due demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Calibration Due demo: nine fictional gauges and a month of gauge use, as of 2026-11-18. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  9 gauge(s) as of 2026-11-18: 1 overdue, 3 measurement(s) with a suspect gauge, 2 to review, 2 due soon, 3 in calibration.
    flag         CAL-003                         overdue, used_while_overdue
    watch        HG-004                          due_soon
    flag         MIC-002                         failed_then_used
    review       PG-005                          never_calibrated
    watch        THR-009                         due_soon
    review       TW-006                          no_interval

▶ Explain MIC-002
  status: executed  decision: allow
  MIC-002: flag. MIC-002 failed its calibration on 2026-10-20 and was used afterwards on WO-301 (2026-11-02), WO-305 (2026-11-05). Review that product.

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Calibration due dates as of 2026-11-18 written: 9 gauge(s) as of 2026-11-18: 1 overdue, 3 measurement(s) with a suspect gauge, 2 to review, 2 due soon, 3 in calibration.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  suspect product notice open drafted with 1 open marker(s) ([TO CONFIRM quality manager]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  suspect product notice open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries qms_release_hold itself
  status: blocked  decision: block
  reason: Never places or releases a quality hold in the QMS or ERP.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `calibration_check` | Work out each gauge's next calibration date from the last one and its interval. | runs |
| `calibration_explain` | Show one gauge's figures and findings, from the same files as calibration_check. | runs |
| `calibration_write_report` | Write calibration-due.csv (one row per gauge, with a blank decision column for people to fill in) and calibration-due.html, plus a calendar (.ics) of the due dates into out_dir (default fairmake-out/calibration). | runs |
| `calibration_draft_suspect_product_notice` | Write drafts/suspect_product_notice-open.md: every work order measured with a gauge that had failed calibration or was overdue, for the quality manager to decide on re-inspection. | asks first (Auto can be opted in) |
| `calibration_request_send` | After one named human click (even in Auto), record that the reviewed suspect product notice draft is approved in suspect_product_notice-requests.csv. | one named click, even in Auto (`binding_send`) |
| `qms_release_hold` | Never places or releases a quality hold in the QMS or ERP. | refused |
| `customer_notice_send` | Never notifies a customer about suspect product. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Gauge register (`gauges`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `gauge` (required) | text | Gauge, Gauge ID, Instrument, Instrument ID, Asset | Prüfmittel, Instrument, 計測器, 量具 |
| `description` | text | Description, Gauge Description, Type | Beschreibung, Description, 摘要, 摘要 |
| `location` | text | Location, Area, Department | Lagerort, Emplacement, 保管場所, 库位 |
| `last_cal` | date | Last Calibration, Last Cal, Calibrated On, Last Calibrated | Zuletzt durchgeführt, Dernière réalisation, 前回実施日, 上次执行日期 |
| `interval_days` | number | Interval Days, Calibration Interval, Frequency (days), Cal Interval | Intervall (Tage), Périodicité (jours), 周期（日）, 周期（天） |
| `cal_result` | text | Result, Cal Result, As Found, Last Result | - |
| `gauge_status` | text | Status, Gauge Status, State | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| Calibration software (generic) | Gauge register export | Gauge ID, Last Calibration, Calibration Interval, Result | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Gauge use log (`usage`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `gauge` (required) | text | Gauge, Gauge ID, Instrument | Prüfmittel, Instrument, 計測器, 量具 |
| `work_order` | text | Work Order, Job, Lot, Inspection Lot | Fertigungsauftrag, Ordre de fabrication, 製造指図, 生产工单 |
| `used_date` | date | Used Date, Date, Inspection Date, Measured On | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-calibration-due inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-calibration-due demo
npx -y fairmake-calibration-due mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-calibration-due": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-calibration-due",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-calibration-due -- npx -y fairmake-calibration-due mcp --root .`, or install the `fairmake-calibration-due` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-calibration-due approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-calibration-due approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-calibration-due kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-calibration-due tools                 # every tool, its policy and arguments
fairmake-calibration-due sources               # the columns each input is read from
fairmake-calibration-due inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-calibration-due call calibration_check '{"gauges":"<gauges>"}'
fairmake-calibration-due eval                  # the private eval cases on the fictional fixtures
fairmake-calibration-due demo
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
