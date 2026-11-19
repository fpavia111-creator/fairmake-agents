# Fairmake Supplier Scorecards

`fairmake-supplier-scorecards` · MCP server and CLI · MIT

On-time delivery, rejects in ppm and price against PO per supplier, weighted and ranked, with a scorecard draft per supplier. Disqualifies nobody.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

Per supplier: on-time % (received by the due date plus grace), rejects in ppm, price variance against PO, and a weighted score (weights in settings) ranked best first. Flags on-time below target and ppm above target; lists price above PO; reviews suppliers with few receipts.

| Finding | Example from the fictional demo data |
|---|---|
| `few_receipts` | Sample Steel Supply has 2 receipt(s); the score rests on little data. |
| `high_ppm` | Demo Castings LLC: 3 rejected of 120 received (25000 ppm, target 5000). |
| `low_on_time` | North Example Metals delivered 2 of 3 receipts on time (66.7%, target 95%). |
| `price_over_po` | Fastener Example Co invoiced 60 above PO prices (2.4%). |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## What it needs, and what stays with a person

- `receipts` (required): Purchase receipts under --root: receipt, supplier, item, due and receipt dates, quantity received and rejected, invoice and PO price
- `settings` (optional): settings JSON under --root; anything left out uses the defaults listed in the result as settings_used

It never does these, and any other tool name is blocked:

- Never blocks, disqualifies or changes a supplier in the ERP.
- Never holds or changes payments to a supplier.

`scorecard_draft_scorecard` writes a draft marked DRAFT; nothing goes out from it. Approving it (`scorecard_request_send`) takes one click by a named person, even in Auto, and only records the approval: the agent itself sends, posts, files and pays nothing. What to change, send or pay is a person's decision.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `weights` | `{"on_time":50,"quality":30,"price":20}` | Weight of on_time, quality and price in the score |
| `grace_days` | `0` | Days after the due date that still count as on time |
| `min_receipts` | `3` | Fewer receipts than this make the score a weak signal |
| `on_time_target` | `95` | On-time % below this is flagged |
| `ppm_target` | `5000` | Rejects in parts per million above this are flagged |

<!-- generated:start -->

## A demo run

`npx -y fairmake-supplier-scorecards demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Supplier Scorecards demo: fourteen fictional receipt lines from five suppliers. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  5 supplier(s) over 14 receipt line(s): 2 below target, 1 with too few receipts, 1 invoicing above PO, 1 on target.
    review       Sample Steel Supply             few_receipts
    watch        Fastener Example Co             price_over_po
    flag         Demo Castings LLC               high_ppm
    flag         North Example Metals            low_on_time

▶ Explain Demo Castings LLC
  status: executed  decision: allow
  Demo Castings LLC: flag. Demo Castings LLC: 3 rejected of 120 received (25000 ppm, target 5000).

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Supplier scorecard written: 5 supplier(s) over 14 receipt line(s): 2 below target, 1 with too few receipts, 1 invoicing above PO, 1 on target.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  scorecard Demo Castings LLC drafted with 1 open marker(s) ([TO CONFIRM Demo Castings LLC account or quality contact]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  scorecard Demo-Castings-LLC approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries supplier_disqualify itself
  status: blocked  decision: block
  reason: Never blocks, disqualifies or changes a supplier in the ERP.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `scorecard_check` | Per supplier: on-time % (received by the due date plus grace), rejects in ppm, price variance against PO, and a weighted score (weights in settings) ranked best first. | runs |
| `scorecard_explain` | Show one supplier's figures and findings, from the same files as scorecard_check. | runs |
| `scorecard_write_report` | Write supplier-scorecards.csv (one row per supplier, with a blank decision column for people to fill in) and supplier-scorecards.html into out_dir (default fairmake-out/scorecard). | runs |
| `scorecard_draft_scorecard` | Write drafts/scorecard-<supplier>.md: one supplier's on-time, quality, price and score with the points to work on. | asks first (Auto can be opted in) |
| `scorecard_request_send` | After one named human click (even in Auto), record that the reviewed scorecard draft is approved in scorecard-requests.csv. | one named click, even in Auto (`binding_send`) |
| `supplier_disqualify` | Never blocks, disqualifies or changes a supplier in the ERP. | refused |
| `ap_hold_payments` | Never holds or changes payments to a supplier. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Purchase receipts (`receipts`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `receipt` (required) | text | Receipt, Receipt Line, Receipt Nbr., GRN | Wareneingang, Réception, 入庫番号, 收货单号 |
| `supplier` (required) | text | Supplier, Vendor, Vendor Name | Lieferant, Fournisseur, 仕入先, 供应商 |
| `item` | text | Item, Part, Inventory ID, Part Number | Artikel, Article, 品目, 物料 |
| `due_date` | date | Due Date, Promised On, Promise Date, Requested Date | Fälligkeitsdatum, Date d'échéance, 期日, 截止日期 |
| `receipt_date` | date | Receipt Date, Date, Received Date | Eingangsdatum, Date de réception, 受領日, 收到日期 |
| `qty_received` | number | Qty Received, Receipt Qty., Received Qty, Quantity | Gelieferte Menge, Quantité reçue, 入荷数, 收货数量 |
| `qty_rejected` | number | Qty Rejected, Rejected, Rejected Qty, Returned Qty | Rückweisungsmenge, Quantité refusée, 不合格数, 拒收数量 |
| `unit_price` | amount | Unit Price, Unit Cost, Invoice Price, Price | Einzelpreis, Prix unitaire, 単価, 单价 |
| `po_price` | amount | PO Price, PO Unit Cost, Agreed Price, Contract Price | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked |
|---|---|---|---|
| Acumatica | Purchase receipt lines (PO302000) export | Receipt Nbr., Vendor, Inventory ID, Receipt Qty. | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date; where it says "tested", an agent was run on a real published file in that layout. The other layouts were written from knowledge of the export and were not checked. None was tested against a customer's live account.

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-supplier-scorecards inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-supplier-scorecards demo
npx -y fairmake-supplier-scorecards mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-supplier-scorecards": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-supplier-scorecards",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-supplier-scorecards -- npx -y fairmake-supplier-scorecards mcp --root .`, or install the `fairmake-supplier-scorecards` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-supplier-scorecards approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-supplier-scorecards approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-supplier-scorecards kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-supplier-scorecards tools                 # every tool, its policy and arguments
fairmake-supplier-scorecards sources               # the columns each input is read from
fairmake-supplier-scorecards inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-supplier-scorecards call scorecard_check '{"receipts":"<receipts>"}'
fairmake-supplier-scorecards eval                  # the private eval cases on the fictional fixtures
fairmake-supplier-scorecards demo
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
