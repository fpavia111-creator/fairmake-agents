# Fairmake Labor Efficiency

`fairmake-labor-efficiency` · MCP server and CLI · MIT

Standard hours earned against direct hours clocked by work center, indirect time, and hours or completions with nothing on the other side. By work center, names masked.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

For each work center, compare standard hours earned (quantity completed times standard hours per unit) with direct hours clocked. Flags efficiency below the target, lists efficiency above the ceiling, reviews indirect time above the limit, hours on work orders with no completions and completions with no hours. Results are by work center, never by person.

| Finding | Example from the fictional demo data |
|---|---|
| `high_efficiency` | ASSY earned 15 standard hours on 12 direct hours (125%): the standard may be loose, or hours were not clocked. |
| `high_indirect` | WELD: 4 of 24 hours were indirect (16.7%). |
| `hours_no_output` | ASSY clocked direct hours on WO-5 with no completions recorded there. |
| `low_efficiency` | WELD earned 15 standard hours on 20 direct hours (75%, target at least 85%). |
| `output_no_hours` | SAW completed WO-7 with no hours clocked there. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## What it needs, and what stays with a person

- `labor` (required): Labor tickets under --root: entry, employee, work center, work order, date, hours and whether the time was indirect
- `earned` (required): Completions under --root: work order, work center, quantity completed and standard hours per unit
- `settings` (optional): settings JSON under --root; anything left out uses the defaults listed in the result as settings_used

It never does these, and any other tool name is blocked:

- Never changes pay, bonuses or payroll.
- Never edits labor tickets or time clock records.

`labor_draft_standards_review` writes a draft marked DRAFT; nothing goes out from it. Approving it (`labor_request_send`) takes one click by a named person, even in Auto, and only records the approval: the agent itself sends, posts, files and pays nothing. What to change, send or pay is a person's decision.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `min_efficiency_pct` | `85` | Earned hours below this percentage of direct hours are flagged |
| `max_efficiency_pct` | `120` | Above this percentage the standard may be loose; listed to watch |
| `max_indirect_pct` | `15` | Indirect hours above this share of all hours are reviewed |

<!-- generated:start -->

## A demo run

`npx -y fairmake-labor-efficiency demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Labor Efficiency demo: fictional labor tickets and completions on five work centers. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  5 work center(s), 10 labor ticket(s): 60.5 standard hours earned on 61 direct hours (99.2%), 6 indirect. 1 below target, 2 to review, 0 to watch, 2 on target.
    review       ASSY                            high_efficiency, hours_no_output
    review       SAW                             output_no_hours
    flag         WELD                            low_efficiency, high_indirect

▶ Explain WELD
  status: executed  decision: allow
  WELD: flag. WELD earned 15 standard hours on 20 direct hours (75%, target at least 85%). WELD: 4 of 24 hours were indirect (16.7%).

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Labor efficiency by work center written: 5 work center(s), 10 labor ticket(s): 60.5 standard hours earned on 61 direct hours (99.2%), 6 indirect. 1 below target, 2 to review, 0 to watch, 2 on target.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  standards review open drafted with 1 open marker(s) ([TO CONFIRM production supervisor and industrial engineer]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  standards review open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries payroll_change itself
  status: blocked  decision: block
  reason: Never changes pay, bonuses or payroll.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `labor_check` | For each work center, compare standard hours earned (quantity completed times standard hours per unit) with direct hours clocked. | runs |
| `labor_explain` | Show one work center's figures and findings, from the same files as labor_check. | runs |
| `labor_write_report` | Write labor-efficiency.csv (one row per work center, with a blank decision column for people to fill in) and labor-efficiency.html into out_dir (default fairmake-out/labor). | runs |
| `labor_draft_standards_review` | Write drafts/standards_review-open.md: the work centers below target, above the ceiling or with unclear hours, for the supervisor and industrial engineer. | asks first (Auto can be opted in) |
| `labor_request_send` | After one named human click (even in Auto), record that the reviewed standards review draft is approved in standards_review-requests.csv. | one named click, even in Auto (`binding_send`) |
| `payroll_change` | Never changes pay, bonuses or payroll. | refused |
| `timeclock_edit` | Never edits labor tickets or time clock records. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Labor tickets (`labor`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `entry` (required) | text | Entry, Entry ID, Labor ID, Transaction, Ticket | - |
| `employee` | text | Employee, Employee Name, Operator, Worker | Mitarbeiter, Employé, 社員名, 员工 |
| `work_center` (required) | text | Work Center, Work Centre, Resource, Department | Arbeitsplatz, Poste de charge, 作業区, 工作中心 |
| `work_order` | text | Work Order, Job, WO, Production Order | Fertigungsauftrag, Ordre de fabrication, 製造指図, 生产工单 |
| `labor_date` | date | Date, Work Date, Labor Date, Clock Date | - |
| `hours` | number | Hours, Actual Hours, Clocked Hours, Labor Hours | Stunden, Heures, 時間, 工时 |
| `indirect` | text | Indirect, Indirect Labor, Non-Productive, Indirect Code | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked |
|---|---|---|---|
| JobBOSS | Labor detail report (CSV) | Employee, Work Center, Job, Hours | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date; where it says "tested", an agent was run on a real published file in that layout. The other layouts were written from knowledge of the export and were not checked. None was tested against a customer's live account.

### Completions with standard hours (`earned`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `work_order` (required) | text | Work Order, Job, WO, Production Order | Fertigungsauftrag, Ordre de fabrication, 製造指図, 生产工单 |
| `work_center` | text | Work Center, Work Centre, Resource | Arbeitsplatz, Poste de charge, 作業区, 工作中心 |
| `qty_completed` | number | Qty Completed, Completed, Quantity Completed, Good Qty | Gefertigte Menge, Quantité produite, 完成数, 完工数量 |
| `std_hours_per_unit` | number | Std Hours per Unit, Standard Hours, Run Hours per Unit, Std Hrs/Unit | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-labor-efficiency inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-labor-efficiency demo
npx -y fairmake-labor-efficiency mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-labor-efficiency": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-labor-efficiency",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-labor-efficiency -- npx -y fairmake-labor-efficiency mcp --root .`, or install the `fairmake-labor-efficiency` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-labor-efficiency approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-labor-efficiency approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-labor-efficiency kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-labor-efficiency tools                 # every tool, its policy and arguments
fairmake-labor-efficiency sources               # the columns each input is read from
fairmake-labor-efficiency inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-labor-efficiency call labor_check '{"labor":"<labor>","earned":"<earned>"}'
fairmake-labor-efficiency eval                  # the private eval cases on the fictional fixtures
fairmake-labor-efficiency demo
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
