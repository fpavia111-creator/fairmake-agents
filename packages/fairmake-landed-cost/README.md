# Fairmake Landed Cost

`fairmake-landed-cost` · MCP server and CLI · MIT

Freight-in, duty and brokerage bills matched to receipts and to the landed cost allocated into item cost. Not a goods three-way match; posts nothing.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

Match every freight, duty and brokerage bill to its receipt and compare with the landed cost allocated into item cost. Flags billed landed cost not allocated; reviews allocations with no bill, receipts from freight-collect suppliers with no freight bill, and bills matching no receipt; lists receipts whose landed cost share is far above the median.

| Finding | Example from the fictional demo data |
|---|---|
| `landed_pct_outlier` | Landed cost is 11.3% of goods value on receipt RCV-703, against a median of 4%. |
| `no_freight_bill` | Demo Castings LLC ships freight collect and receipt RCV-704 has no freight bill yet. Accrue it or chase the carrier. |
| `not_allocated` | Receipt RCV-701: 400 of freight, duty and brokerage billed, 0 allocated into item cost. 400 is sitting outside inventory. |
| `over_allocated` | Receipt RCV-705: 400 allocated into item cost against 0 billed. Check for an estimate that was never trued up. |
| `unmatched_charge` | Freight FB-7 from Ridgeline Freight Example for 180 names receipt RCV-799, which is not in the receipts file. Match it before it lands in a variance account. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `min_amount` | `25` | Differences between billed and allocated landed cost below this amount are ignored |
| `outlier_factor` | `2` | A receipt whose landed cost share of goods value is this many times the median share is listed to watch |
| `collect_suppliers` | `[]` | Suppliers whose freight you pay (collect or FOB origin): a receipt from them with no freight bill is reviewed |

<!-- generated:start -->

## A demo run

`npx -y fairmake-landed-cost demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Landed Cost demo: eight fictional receipts and nine freight, duty and brokerage bills. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  8 receipt(s), 57000 of goods, 3725 of landed cost billed and 2440 allocated: 1410 not allocated, 275 on bills matching no receipt. 3 to allocate, 4 to review, 0 to watch.
    review       FB-7                            unmatched_charge
    review       FB-8                            unmatched_charge
    flag         RCV-701                         not_allocated
    flag         RCV-703                         not_allocated, landed_pct_outlier
    review       RCV-704                         no_freight_bill
    review       RCV-705                         over_allocated
    flag         RCV-707                         not_allocated, landed_pct_outlier

▶ Explain RCV-701
  status: executed  decision: allow
  RCV-701: flag. Receipt RCV-701: 400 of freight, duty and brokerage billed, 0 allocated into item cost. 400 is sitting outside inventory.

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Landed cost and freight-in written: 8 receipt(s), 57000 of goods, 3725 of landed cost billed and 2440 allocated: 1410 not allocated, 275 on bills matching no receipt. 3 to allocate, 4 to review, 0 to watch.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  landed cost adjustment open drafted for 1410 with 1 open marker(s) ([TO CONFIRM accountant who posts landed cost]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: move_money stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  landed cost adjustment open approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries erp_post_landed_cost itself
  status: blocked  decision: block
  reason: Never posts landed cost, freight or duty allocations in the ERP.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `landed_cost_check` | Match every freight, duty and brokerage bill to its receipt and compare with the landed cost allocated into item cost. | runs |
| `landed_cost_explain` | Show one receipt or bill's figures and findings, from the same files as landed_cost_check. | runs |
| `landed_cost_write_report` | Write landed-cost.csv (one row per receipt or bill, with a blank decision column for people to fill in) and landed-cost.html into out_dir (default fairmake-out/landed-cost). | runs |
| `landed_cost_draft_landed_cost_adjustment` | Write drafts/landed_cost_adjustment-open.md: every receipt with landed cost billed and not allocated, with the bills behind it. | asks first (Auto can be opted in) |
| `landed_cost_request_approve` | After one named human click (even in Auto), record that the reviewed landed cost adjustment draft is approved in landed_cost_adjustment-requests.csv. | one named click, even in Auto (`move_money`) |
| `erp_post_landed_cost` | Never posts landed cost, freight or duty allocations in the ERP. | refused |
| `ap_pay_invoice` | Never pays a freight, duty or brokerage bill. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Purchase receipts (`receipts`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `receipt` (required) | text | Receipt, Receipt No., Receipt Nbr., Receipt Number, GRN | Wareneingang, Réception, 入庫番号, 收货单号 |
| `supplier` | text | Supplier, Vendor, Vendor Name | Lieferant, Fournisseur, 仕入先, 供应商 |
| `receipt_date` | date | Receipt Date, Date, Received Date | Eingangsdatum, Date de réception, 受領日, 收到日期 |
| `goods_value` | amount | Goods Value, Ext. Cost, Extended Cost, Receipt Value, Amount | Warenwert, Valeur marchandise, 商品価格, 货值 |
| `landed_allocated` | amount | Landed Allocated, Landed Cost, Freight Allocated, Landed Cost Amount | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| Acumatica | Purchase receipt lines (PO302000) export | Receipt Nbr., Vendor, Inventory ID, Receipt Qty. | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Freight, duty and brokerage bills (`charges`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `charge_id` (required) | text | Charge ID, Bill Number, Invoice Number, Freight Bill, Reference | - |
| `receipt` | text | Receipt, Receipt No., Receipt Nbr., Applies To, Related Receipt | Wareneingang, Réception, 入庫番号, 收货单号 |
| `vendor` | text | Vendor, Carrier, Broker, Bill From | Lieferant, Fournisseur, 仕入先, 供应商 |
| `charge_type` | text | Charge Type, Type, Cost Type, Description | - |
| `amount` | amount | Amount, Charge Amount, Total, Bill Amount | Betrag, Montant, 金額, 金额 |
| `invoice_date` | date | Invoice Date, Bill Date, Date | Rechnungsdatum, Date de facture, 請求日, 发票日期 |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-landed-cost inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-landed-cost demo
npx -y fairmake-landed-cost mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-landed-cost": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-landed-cost",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-landed-cost -- npx -y fairmake-landed-cost mcp --root .`, or install the `fairmake-landed-cost` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-landed-cost approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-landed-cost approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-landed-cost kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-landed-cost tools                 # every tool, its policy and arguments
fairmake-landed-cost sources               # the columns each input is read from
fairmake-landed-cost inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-landed-cost call landed_cost_check '{"receipts":"<receipts>","charges":"<charges>"}'
fairmake-landed-cost eval                  # the private eval cases on the fictional fixtures
fairmake-landed-cost demo
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
