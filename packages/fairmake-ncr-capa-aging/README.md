# Fairmake NCR CAPA Aging

`fairmake-ncr-capa-aging` · MCP server and CLI · MIT

Open nonconformances past the limit, overdue or unverified corrective actions, missing dispositions and root causes, and repeat defects with no CAPA. Owners masked; closes nothing.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

Flags NCRs open past the limit, CAPAs past their due date, CAPAs closed with no effectiveness check, and the same part and defect seen the repeat number of times with no CAPA; reviews NCRs with no disposition, CAPAs with no root cause and NCRs pointing at CAPAs not in the log.

| Finding | Example from the fictional demo data |
|---|---|
| `capa_not_found` | NCR NCR-105 points to CAPA CAPA-99, which is not in the CAPA log. |
| `capa_overdue` | CAPA CAPA-21 was due 2026-10-31 (18 days ago) and is still open. |
| `closed_unverified` | CAPA CAPA-23 was closed 2026-08-15 without a check that the action worked. |
| `ncr_overdue` | NCR NCR-101 (HSG-300, POROSITY) has been open 78 days. |
| `no_disposition` | NCR NCR-101 has no disposition (use as is, rework, scrap, return). |
| `no_root_cause` | CAPA CAPA-22 has no root cause recorded. |
| `repeat_without_capa` | 3 NCRs for HSG-300 with defect POROSITY (NCR-101, NCR-102, NCR-103) and no corrective action. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## What it needs, and what stays with a person

- `ncrs` (required): Nonconformance log under --root: NCR, dates opened and closed, part, supplier, defect code, disposition, CAPA, status, owner
- `capas` (optional): Corrective action log under --root: CAPA, dates opened, due and closed, root cause, effectiveness verified, status, owner
- `as_of` (optional): Date to age from, YYYY-MM-DD (default today)
- `settings` (optional): settings JSON under --root; anything left out uses the defaults listed in the result as settings_used

It never does these, and any other tool name is blocked:

- Never opens, closes or edits an NCR or CAPA in the QMS.
- Never sends a corrective action request or notice to a supplier.

`ncr_draft_capa_reminder` writes a draft marked DRAFT; nothing goes out from it. Approving it (`ncr_request_send`) takes one click by a named person, even in Auto, and only records the approval: the agent itself sends, posts, files and pays nothing. What to change, send or pay is a person's decision.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `ncr_days` | `30` | An NCR open longer than this many days is overdue |
| `repeat_count` | `3` | This many NCRs for the same part and defect with no CAPA is a repeat defect |

<!-- generated:start -->

## A demo run

`npx -y fairmake-ncr-capa-aging demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake NCR CAPA Aging demo: ten fictional NCRs and four CAPAs, as of 2026-11-18. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  10 NCR(s) (5 open) and 4 CAPA(s) as of 2026-11-18: 4 need action, 3 to complete, 7 in order; 1 repeat defect(s) with no CAPA.
    flag         CAPA-21                         capa_overdue
    review       CAPA-22                         no_root_cause
    flag         CAPA-23                         closed_unverified
    flag         NCR-101                         ncr_overdue, no_disposition
    flag         NCR-103                         repeat_without_capa
    review       NCR-105                         no_disposition, capa_not_found
    review       NCR-107                         no_disposition

▶ Explain CAPA-21
  status: executed  decision: allow
  CAPA-21: flag. CAPA CAPA-21 was due 2026-10-31 (18 days ago) and is still open.

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Nonconformance and corrective action aging as of 2026-11-18 written: 10 NCR(s) (5 open) and 4 CAPA(s) as of 2026-11-18: 4 need action, 3 to complete, 7 in order; 1 repeat defect(s) with no CAPA.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  capa reminder open drafted with 1 open marker(s) ([TO CONFIRM quality team]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  capa reminder open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries qms_close_capa itself
  status: blocked  decision: block
  reason: Never opens, closes or edits an NCR or CAPA in the QMS.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `ncr_check` | Flags NCRs open past the limit, CAPAs past their due date, CAPAs closed with no effectiveness check, and the same part and defect seen the repeat number of times with no CAPA; reviews NCRs with no disposition, CAPAs w… | runs |
| `ncr_explain` | Show one NCR or CAPA's figures and findings, from the same files as ncr_check. | runs |
| `ncr_write_report` | Write ncr-capa-aging.csv (one row per NCR or CAPA, with a blank decision column for people to fill in) and ncr-capa-aging.html into out_dir (default fairmake-out/ncr). | runs |
| `ncr_draft_capa_reminder` | Write drafts/capa_reminder-open.md: every NCR and CAPA that needs action, with owner and dates, for the quality team. | asks first (Auto can be opted in) |
| `ncr_request_send` | After one named human click (even in Auto), record that the reviewed capa reminder draft is approved in capa_reminder-requests.csv. | one named click, even in Auto (`binding_send`) |
| `qms_close_capa` | Never opens, closes or edits an NCR or CAPA in the QMS. | refused |
| `supplier_notice_send` | Never sends a corrective action request or notice to a supplier. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Nonconformance log (`ncrs`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `ncr` (required) | text | NCR, NCR Number, NCR No., Nonconformance | - |
| `opened` | date | Opened, Date Opened, Open Date, Reported | - |
| `closed` | date | Closed, Date Closed, Close Date | - |
| `part` | text | Part, Part Number, Item, Product | Artikel, Article, 品目, 物料 |
| `supplier` | text | Supplier, Vendor, Source | Lieferant, Fournisseur, 仕入先, 供应商 |
| `defect_code` | text | Defect Code, Defect, Defect Type, Failure Mode | Fehlerart, Code défaut, 不良コード, 缺陷代码 |
| `disposition` | text | Disposition, MRB Disposition, Decision | - |
| `capa` | text | CAPA, CAPA Number, Corrective Action, CAR | - |
| `ncr_status` | text | Status, NCR Status, State | - |
| `owner` | text | Owner, Assigned To, Responsible | Verantwortlich, Responsable, 担当者, 负责人 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked |
|---|---|---|---|
| QMS (generic) | Nonconformance log export | NCR Number, Date Opened, Part Number, Defect Code | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date; where it says "tested", an agent was run on a real published file in that layout. The other layouts were written from knowledge of the export and were not checked. None was tested against a customer's live account.

### Corrective action log (`capas`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `capa` (required) | text | CAPA, CAPA Number, CAR, Corrective Action | - |
| `opened` | date | Opened, Date Opened, Open Date | - |
| `due` | date | Due, Due Date, Target Date | - |
| `closed` | date | Closed, Date Closed, Close Date | - |
| `root_cause` | text | Root Cause, Cause, Root Cause Analysis | - |
| `verified` | text | Verified, Effectiveness Verified, Effective, Verification Done | - |
| `capa_status` | text | Status, CAPA Status, State | - |
| `owner` | text | Owner, Assigned To, Responsible | Verantwortlich, Responsable, 担当者, 负责人 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-ncr-capa-aging inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-ncr-capa-aging demo
npx -y fairmake-ncr-capa-aging mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-ncr-capa-aging": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-ncr-capa-aging",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-ncr-capa-aging -- npx -y fairmake-ncr-capa-aging mcp --root .`, or install the `fairmake-ncr-capa-aging` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-ncr-capa-aging approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-ncr-capa-aging approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-ncr-capa-aging kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-ncr-capa-aging tools                 # every tool, its policy and arguments
fairmake-ncr-capa-aging sources               # the columns each input is read from
fairmake-ncr-capa-aging inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-ncr-capa-aging call ncr_check '{"ncrs":"<ncrs>"}'
fairmake-ncr-capa-aging eval                  # the private eval cases on the fictional fixtures
fairmake-ncr-capa-aging demo
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
