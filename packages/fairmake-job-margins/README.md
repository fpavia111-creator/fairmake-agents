# fairmake-job-margins

Quoted against actual cost and invoiced amount per job, with losses, overruns, under-billing and margins by customer and estimator. Changes no price.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

For each job, compare quoted price and cost with actual cost and the amount invoiced. Flags losses, overruns past the threshold and closed jobs invoiced below the quote; lists margins under target and jobs with no quote. Rolls up by customer and estimator (estimator names are masked in results).

| Finding | Example from the fictional demo data |
|---|---|
| `below_target` | J-5003 made 16.7% against a 20% target. |
| `cost_overrun` | J-5002 cost 8600 against 6000 quoted (43.3% over). |
| `loss` | J-5002 lost 600: 8000 invoiced against 8600 actual cost. |
| `no_quote` | J-5006 has no quoted price, so it cannot be compared with its quote. |
| `under_billed` | J-5004 is closed with 5200 invoiced against 6000 quoted: 800 not billed. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `note` | `` | Free text for your own records |
| `target_margin_pct` | `20` | A job below this gross margin percentage is listed for review |
| `overrun_pct` | `10` | Actual cost this far above the quoted cost is a cost overrun |
| `min_amount` | `100` | Overruns and under-billing below this amount are ignored |

<!-- generated:start -->

## A demo run

`npx -y fairmake-job-margins demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Job Margins demo: ten fictional jobs at a fictional job shop. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  10 job(s), 84700 revenue against 68850 cost: losses 900, overruns 5400, not billed 800. 4 to act on, 1 without a quote, 1 under target, 4 on target.
    flag         J-5002                          loss, cost_overrun
    flag         J-5003                          cost_overrun, below_target
    flag         J-5004                          under_billed, below_target
    review       J-5006                          no_quote
    watch        J-5007                          below_target
    flag         J-5009                          loss, cost_overrun

▶ Explain J-5003
  status: executed  decision: allow
  J-5003: flag. J-5003 cost 12500 against 11000 quoted (13.6% over). J-5003 made 16.7% against a 20% target.

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Quoted against actual job margin written: 10 job(s), 84700 revenue against 68850 cost: losses 900, overruns 5400, not billed 800. 4 to act on, 1 without a quote, 1 under target, 4 on target.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  requote note open drafted for 1700 with 1 open marker(s) ([TO CONFIRM estimating and sales lead]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  requote note open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries erp_update_price_list itself
  status: blocked  decision: block
  reason: Never changes quotes, price lists or estimates in the ERP.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `job_margin_check` | For each job, compare quoted price and cost with actual cost and the amount invoiced. | runs |
| `job_margin_explain` | Show one job's figures and findings, from the same files as job_margin_check. | runs |
| `job_margin_write_report` | Write job-margins.csv (one row per job, with a blank decision column for people to fill in) and job-margins.html into out_dir (default fairmake-out/job-margin). | runs |
| `job_margin_draft_requote_note` | Write drafts/requote_note-open.md: the jobs that lost money, overran or were under-billed, for the estimating and sales lead to review before the next quote. | asks first (Auto can be opted in) |
| `job_margin_request_send` | After one named human click (even in Auto), record that the reviewed requote note draft is approved in requote_note-requests.csv. | one named click, even in Auto (`binding_send`) |
| `erp_update_price_list` | Never changes quotes, price lists or estimates in the ERP. | refused |
| `customer_invoice_send` | Never invoices a customer or sends anything to one. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Job cost summary (`jobs`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `job` (required) | text | Job, Job Number, Job No., Work Order, Project | Auftrag, Affaire, 案件, 作业 |
| `customer` | text | Customer, Customer Name, Client | Kunde, Client, 顧客, 客户 |
| `estimator` | text | Estimator, Quoted By, Salesperson, Sales Rep | - |
| `quoted_price` | amount | Quoted Price, Quote Price, Sell Price, Quote Amount, Contract Value | Angebotspreis, Prix du devis, 見積価格, 报价 |
| `quoted_cost` | amount | Quoted Cost, Est Total Cost, Estimated Cost, Quote Cost | Kalkulierte Kosten, Coût devisé, 見積原価, 预估成本 |
| `actual_cost` | amount | Actual Cost, Act Total Cost, Total Actual Cost, Job Cost | Istkosten, Coût réel, 実際原価, 实际成本 |
| `invoiced` | amount | Invoiced, Invoiced Amount, Billed, Revenue, Amount Invoiced | - |
| `job_status` | text | Status, Job Status | - |
| `closed_date` | date | Closed Date, Close Date, Completed Date | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| JobBOSS | Job cost summary report (CSV) | Job, Customer, Quoted Price, Act Total Cost | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-job-margins inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-job-margins demo
npx -y fairmake-job-margins mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-job-margins": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-job-margins",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-job-margins -- npx -y fairmake-job-margins mcp --root .`, or install the `fairmake-job-margins` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-job-margins approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-job-margins approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-job-margins kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-job-margins tools                 # every tool, its policy and arguments
fairmake-job-margins sources               # the columns each input is read from
fairmake-job-margins inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-job-margins call job_margin_check '{"jobs":"<jobs>"}'
fairmake-job-margins eval                  # the private eval cases on the fictional fixtures
fairmake-job-margins demo
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
- The bundled fixtures are fictional. Version 0.1.0; nothing has been published yet.
