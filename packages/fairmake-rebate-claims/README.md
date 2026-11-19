# Fairmake Rebate Claims

`fairmake-rebate-claims` · MCP server and CLI · MIT

Supplier rebate tiers reached and not claimed, claim-by dates passed, spend near the next tier and purchases above the agreed price, with a claim draft per agreement.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

For each agreement: purchases in its period (by supplier and, if set, item), the tier reached and rebate earned, credits received, and lines above the agreed price. Flags rebates still unclaimed after the period and overpayments; reviews claim-by dates passed; lists rebates accruing and spend close to the next tier.

| Finding | Example from the fictional demo data |
|---|---|
| `claim_window_passed` | NWM-2026: the claim-by date 2026-10-31 has passed; ask the supplier whether a late claim is accepted. |
| `near_next_tier` | DSI-2026: 1500 more spend by 2026-12-31 reaches the 4% tier. |
| `over_contract_price` | FEC-2026: 1 purchase line(s) of SCR-M8 above the agreed 0.05 (P6 at 0.06): 200 overpaid. |
| `rebate_accruing` | DSI-2026: 18500 spent so far reaches the 2% tier (370 earned to date); the period runs to 2026-12-31. |
| `rebate_unclaimed` | NWM-2026: 120000 spent from 2026-01-01 to 2026-09-30 reaches the 2% tier: 2400 earned, 1000 claimed, 1400 still to claim. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## What it needs, and what stays with a person

- `purchases` (required): Purchase lines under --root: line, supplier, item, date, quantity, unit price
- `agreements` (required): Agreements JSON under --root: id, supplier, optional item and contract price, start and end, claim-by date, rebate tiers (min spend, %)
- `claims` (optional): rebate credits already received under --root: agreement and amount
- `as_of` (optional): Date to measure from, YYYY-MM-DD (default today)
- `settings` (optional): settings JSON under --root; anything left out uses the defaults listed in the result as settings_used

It never does these, and any other tool name is blocked:

- Never short-pays or deducts from a supplier payment.
- Never submits a claim in a supplier portal.

`rebates_draft_rebate_claim` writes a draft marked DRAFT; nothing goes out from it. Approving it (`rebates_request_send`) takes one click by a named person, even in Auto, and only records the approval: the agent itself sends, posts, files and pays nothing. What to change, send or pay is a person's decision.

## Settings

Put the ones you want to change in a JSON file and pass it as `settings`; anything left out uses the default. The result lists the settings it used under `settings_used`.

| Setting | Default | Meaning |
|---|---|---|
| `near_tier_pct` | `10` | Spend within this percentage below the next tier is listed |

<!-- generated:start -->

## A demo run

`npx -y fairmake-rebate-claims demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Rebate Claims demo: four fictional supplier agreements and a year of purchase lines, as of 2026-11-18. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  4 agreement(s), 147200 of spend covered as of 2026-11-18: 1400 of rebate to claim, 200 paid above agreed prices. 2 to claim, 0 past the claim date, 1 accruing or near a tier, 1 settled.
    watch        DSI-2026                        rebate_accruing, near_next_tier
    flag         FEC-2026                        rebate_accruing, over_contract_price
    flag         NWM-2026                        rebate_unclaimed, claim_window_passed

▶ Explain NWM-2026
  status: executed  decision: allow
  NWM-2026: flag. NWM-2026: 120000 spent from 2026-01-01 to 2026-09-30 reaches the 2% tier: 2400 earned, 1000 claimed, 1400 still to claim. NWM-2026: the claim-by date 2026-10-31 has passed; ask the supplier whether a late claim is accepted.

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Rebates and price agreements written: 4 agreement(s), 147200 of spend covered as of 2026-11-18: 1400 of rebate to claim, 200 paid above agreed prices. 2 to claim, 0 past the claim date, 1 accruing or near a tier, 1 settled.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  rebate claim NWM-2026 drafted for 1400 with 2 open marker(s) ([TO CONFIRM Northwind Metals rebate or account contact], [ATTACH purchase line detail]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  rebate claim NWM-2026 approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries ap_deduct_from_payment itself
  status: blocked  decision: block
  reason: Never short-pays or deducts from a supplier payment.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `rebates_check` | For each agreement: purchases in its period (by supplier and, if set, item), the tier reached and rebate earned, credits received, and lines above the agreed price. | runs |
| `rebates_explain` | Show one agreement's figures and findings, from the same files as rebates_check. | runs |
| `rebates_write_report` | Write rebate-claims.csv (one row per agreement, with a blank decision column for people to fill in) and rebate-claims.html into out_dir (default fairmake-out/rebates). | runs |
| `rebates_draft_rebate_claim` | Write drafts/rebate_claim-<agreement>.md: the rebate earned, credited and still due, plus overpayment against the agreed price, asking the supplier for a credit note. | asks first (Auto can be opted in) |
| `rebates_request_send` | After one named human click (even in Auto), record that the reviewed rebate claim draft is approved in rebate_claim-requests.csv. | one named click, even in Auto (`binding_send`) |
| `ap_deduct_from_payment` | Never short-pays or deducts from a supplier payment. | refused |
| `supplier_portal_submit` | Never submits a claim in a supplier portal. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Purchase lines (`purchases`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `line` (required) | text | Line, Line ID, Invoice Line, Transaction Line | Position, Ligne, 明細番号, 行号 |
| `supplier` (required) | text | Supplier, Vendor, Vendor Name | Lieferant, Fournisseur, 仕入先, 供应商 |
| `item` | text | Item, Part, Part Number, SKU | Artikel, Article, 品目, 物料 |
| `purchase_date` | date | Date, Invoice Date, Purchase Date, Receipt Date | - |
| `qty` | number | Qty, Quantity | Menge, Quantité, 数量, 数量 |
| `unit_price` | amount | Unit Price, Rate, Price | Einzelpreis, Prix unitaire, 単価, 单价 |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| NetSuite | Transaction saved search, purchase lines (default column labels) | Document Number, Vendor, Item, Rate | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Rebate credits received (`claims`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `agreement` (required) | text | Agreement, Agreement ID, Program, Contract | - |
| `amount` | amount | Amount, Claimed, Claim Amount, Credit | Betrag, Montant, 金額, 金额 |
| `claim_date` | date | Claim Date, Date, Credited On | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-rebate-claims inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-rebate-claims demo
npx -y fairmake-rebate-claims mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-rebate-claims": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-rebate-claims",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-rebate-claims -- npx -y fairmake-rebate-claims mcp --root .`, or install the `fairmake-rebate-claims` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-rebate-claims approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-rebate-claims approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-rebate-claims kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-rebate-claims tools                 # every tool, its policy and arguments
fairmake-rebate-claims sources               # the columns each input is read from
fairmake-rebate-claims inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-rebate-claims call rebates_check '{"purchases":"<purchases>","agreements":"<agreements>"}'
fairmake-rebate-claims eval                  # the private eval cases on the fictional fixtures
fairmake-rebate-claims demo
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
