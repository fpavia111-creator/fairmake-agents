# Fairmake OSHA 300 Log

`fairmake-osha-300-log` · MCP server and CLI · MIT

Completeness of the injury and illness case log: missing fields, outcomes against day counts, day caps, privacy cases with names, open cases and late entries. Names masked; decides and files nothing.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

For each case: flags day counts that contradict the outcome and privacy cases with a name entered; reviews missing fields on recordable cases, missing day counts, repeated case numbers, late entries and first-aid cases marked recordable; lists day counts over the cap (counting may stop there) and, when the file has return dates, cases with days still running. Reads OSHA's published ITA case layout (outcome codes 1 to 4). Counts cases and days by outcome; rates per 200,000 hours if annual hours are set. Names and job titles are masked in results.

| Finding | Example from the fictional demo data |
|---|---|
| `days_missing` | Case 2026-003 is a restriction case with no restricted days entered. |
| `days_over_cap` | Case 2026-007 counts 210 days; counting may stop at 180, and the totals here count it at 180. |
| `first_aid_recordable` | Case 2026-008 is marked recordable with a first-aid outcome; check the classification. |
| `late_entry` | Case 2026-004 was entered 26 days after it happened. |
| `missing_field` | Case 2026-006 is missing job_title, location. |
| `open_case` | Case 2026-003 has no return-to-work date; keep counting days. |
| `outcome_days_mismatch` | Case 2026-004 shows 3 days away but its outcome is "Other recordable". |
| `privacy_name_on_log` | Case 2026-005 is marked as a privacy case but a name is entered; the name column should say privacy case. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## What it needs, and what stays with a person

- `cases` (required): Injury and illness case log under --root: case number, employee, job title, dates, location, description, injury type, outcome, days away and restricted, privacy case, recordable, return date
- `settings` (optional): settings JSON under --root; anything left out uses the defaults listed in the result as settings_used

It never does these, and any other tool name is blocked:

- Never submits injury and illness data to any agency or portal.
- Never changes HR, EHS or case records.

`osha_log_draft_log_correction_list` writes a draft marked DRAFT; nothing goes out from it. Approving it (`osha_log_request_send`) takes one click by a named person, even in Auto, and only records the approval: the agent itself sends, posts, files and pays nothing. What to change, send or pay is a person's decision.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `day_cap` | `180` | Most days away plus restricted to count for one case (the cap your log uses) |
| `entry_days` | `7` | A case entered more than this many days after it happened is listed as a late entry |
| `annual_hours` | `null` | Hours worked by all employees in the year, to compute rates per 200,000 hours (leave out to skip rates) |

<!-- generated:start -->

## A demo run

`npx -y fairmake-osha-300-log demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake OSHA 300 Log demo: eight fictional cases at a fictional plant; every name is made up. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  8 case(s), 8 marked recordable, 5 with days away or restriction (128 days away, 90 restricted), TRIR 6.4, DART 4: 2 to correct, 3 to complete, 1 to watch, 2 complete.
    review       2026-003                        days_missing, open_case
    flag         2026-004                        outcome_days_mismatch, late_entry
    flag         2026-005                        days_missing, privacy_name_on_log
    review       2026-006                        missing_field
    watch        2026-007                        days_over_cap, open_case
    review       2026-008                        first_aid_recordable

▶ Explain 2026-004
  status: executed  decision: allow
  2026-004: flag. Case 2026-004 shows 3 days away but its outcome is "Other recordable". Case 2026-004 was entered 26 days after it happened.

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Injury and illness log completeness written: 8 case(s), 8 marked recordable, 5 with days away or restriction (128 days away, 90 restricted), TRIR 6.4, DART 4: 2 to correct, 3 to complete, 1 to watch, 2 complete.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  log correction list open drafted with 1 open marker(s) ([TO CONFIRM safety coordinator]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  log correction list open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries osha_ita_submit itself
  status: blocked  decision: block
  reason: Never submits injury and illness data to any agency or portal.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `osha_log_check` | For each case: flags day counts that contradict the outcome and privacy cases with a name entered; reviews missing fields on recordable cases, missing day counts, repeated case numbers, late entries and first-aid case… | runs |
| `osha_log_explain` | Show one case's figures and findings, from the same files as osha_log_check. | runs |
| `osha_log_write_report` | Write osha-300-log.csv (one row per case, with a blank decision column for people to fill in) and osha-300-log.html into out_dir (default fairmake-out/osha-log). | runs |
| `osha_log_draft_log_correction_list` | Write drafts/log_correction_list-open.md: every case needing a correction, by case number, for the safety coordinator. | asks first (Auto can be opted in) |
| `osha_log_request_send` | After one named human click (even in Auto), record that the reviewed log correction list draft is approved in log_correction_list-requests.csv. | one named click, even in Auto (`binding_send`) |
| `osha_ita_submit` | Never submits injury and illness data to any agency or portal. | refused |
| `hr_record_update` | Never changes HR, EHS or case records. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Injury and illness cases (`cases`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `establishment` | text | Establishment ID, Establishment, Establishment Name, Site, Plant, Facility | - |
| `case_number` (required) | text | Case Number, Case No., Case, Incident ID | - |
| `employee` | text | Employee, Employee Name, Name | Mitarbeiter, Employé, 社員名, 员工 |
| `job_title` | text | Job Title, Position, Job, Job Description | Rolle, Rôle, ロール, 角色 |
| `incident_date` | date | Incident Date, Date of Injury, Date of Injury or Illness, Date of Incident, Date | - |
| `entered_date` | date | Entered Date, Date Recorded, Logged On, Created | - |
| `location` | text | Location, Where, Where the Event Occurred, Area, Incident Location, NEW_INCIDENT_LOCATION | Lagerort, Emplacement, 保管場所, 库位 |
| `description` | text | Description, Injury Description, What Happened, Incident Description, NEW_INCIDENT_DESCRIPTION, NAR What Happened | Beschreibung, Description, 摘要, 摘要 |
| `injury_type` | text | Injury Type, Type, Illness Type, Case Type, Type of Incident | - |
| `outcome` | text | Outcome, Classification, Most Serious Outcome, Result, Incident Outcome | - |
| `days_away` | number | Days Away, Days Away From Work, Lost Days, DAFW Num Away | - |
| `days_restricted` | number | Days Restricted, Days on Job Transfer or Restriction, Restricted Days, DJTR Num TR | - |
| `privacy_case` | text | Privacy Case, Privacy | - |
| `recordable` | text | Recordable, OSHA Recordable, Is Recordable | - |
| `return_date` | date | Return Date, Returned to Work, Back to Work | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked |
|---|---|---|---|
| EHS software (generic) | Incident log export | Case Number, Date of Injury, Job Title, Days Away | no |
| OSHA Injury Tracking Application | Case detail data (Forms 300 and 301) as OSHA publishes it | establishment_id, case_number, date_of_incident, incident_outcome, dafw_num_away, djtr_num_tr | tested on OSHA ITA Case Detail Data 2024 (published file, osha.gov/itadata), 19 Nov 2026 |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date; where it says "tested", an agent was run on a real published file in that layout. The other layouts were written from knowledge of the export and were not checked. None was tested against a customer's live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-osha-300-log inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-osha-300-log demo
npx -y fairmake-osha-300-log mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-osha-300-log": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-osha-300-log",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-osha-300-log -- npx -y fairmake-osha-300-log mcp --root .`, or install the `fairmake-osha-300-log` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-osha-300-log approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-osha-300-log approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-osha-300-log kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-osha-300-log tools                 # every tool, its policy and arguments
fairmake-osha-300-log sources               # the columns each input is read from
fairmake-osha-300-log inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-osha-300-log call osha_log_check '{"cases":"<cases>"}'
fairmake-osha-300-log eval                  # the private eval cases on the fictional fixtures
fairmake-osha-300-log demo
```

## Audit log and data

Every call is written to `.fairmake/audit.jsonl` under the root: hash-chained JSON lines, with arguments stored as a hash, signed with an Ed25519 key when you configure one. Everything runs on your machine on files you choose. No network calls, no telemetry, no credentials. The bundled fixtures are fictional.

<!-- generated:end -->

## Limits

- Reads only the files you give it. It does not log in to an ERP, MES, CMMS, QMS, EDI network, bank, supplier or customer portal, and changes nothing in them.
- Thresholds and rules are settings in your own file, with working defaults listed in the result as settings_used. They are not a costing, quality or safety standard; check them against your own policies and contracts.
- Not legal, tax, customs, safety or accounting advice. A person decides what to change, post, send or pay.
- People's names in these files are masked in results returned to the AI model. The report and draft files written here keep the real values: keep them in a private folder.
- Column names for the named exports were written from knowledge of those systems and not checked against a live account; `inspect` shows how a file was read and `fairmake-sources.json` names columns by hand.
- The bundled fixtures are fictional. Version 0.1.0.
