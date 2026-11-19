# Fairmake Material Certs

`fairmake-material-certs` · MCP server and CLI · MIT

Mill test reports and certificates of conformance on receipts against your purchase specs: missing, wrong lot or heat, out of spec or incomplete. Releases no hold.

Part of **Fairmake**, the back-office agents for small and mid-size manufacturers and distributors by Mythos Machines. The software is free (MIT); the paid part is a fixed-price setup on your own files. Every result is computed from your files with plain arithmetic, on your computer; no AI model is called by the tools.

## What it checks

For each receipt line of an item with a spec: flags a missing certificate where one is required, a certificate for another lot or heat and properties outside the spec min/max; reviews properties the certificate does not report and certificate ids not in the certificates file; lists items with no spec. Totals problems by supplier.

| Finding | Example from the fictional demo data |
|---|---|
| `cert_lot_mismatch` | Certificate MTR-2001 is for lot P-76; receipt RC-2004 is lot P-77. |
| `cert_missing` | Receipt RC-2003 of BAR-4140 lot H-1003 from North Example Metals has no certificate; your spec requires one. |
| `cert_not_found` | Receipt RC-2006 names certificate COC-9, which is not in the certificates file. |
| `no_spec` | GSK-220 has no spec in the specs file, so its certificate is not checked. |
| `out_of_spec` | Certificate MTR-1002 reports tensile_ksi 92; your spec is min 95. |
| `property_missing` | Certificate MTR-2002 does not report yield_ksi. |

Each item gets the most serious level of its findings: **flag** (act on it), **review** (data is missing or unclear; a person looks), **watch** (worth knowing) or **ok**. Every finding names the numbers it was worked out from.

## What it needs, and what stays with a person

- `receipts` (required): Receipt lines under --root: receipt, item, lot or heat, supplier, date, certificate id
- `specs` (required): Specs JSON under --root: per item, whether a certificate is required and the min/max of each property
- `certs` (optional): certificate values under --root, one row per property: certificate id, lot or heat, property, value

It never does these, and any other tool name is blocked:

- Never places or releases a quality hold on received material.
- Never pays, holds or short-pays a supplier invoice.

`certs_draft_cert_request` writes a draft marked DRAFT; nothing goes out from it. Approving it (`certs_request_send`) takes one click by a named person, even in Auto, and only records the approval: the agent itself sends, posts, files and pays nothing. What to change, send or pay is a person's decision.

<!-- generated:start -->

## A demo run

`npx -y fairmake-material-certs demo` runs the agent on the fictional files in [`fixtures/`](fixtures) in a temporary folder. Captured output:

```text
Fairmake Material Certs demo: eight fictional receipt lines from four fictional suppliers. Auto mode is on for drafts only.

▶ Run the check on the exported files
  status: executed  decision: allow
  8 receipt line(s), 4 certificate(s) on file: 3 missing, wrong lot or out of spec, 2 incomplete, 1 with no spec, 2 in order.
    flag         RC-2002                         out_of_spec
    flag         RC-2003                         cert_missing
    flag         RC-2004                         cert_lot_mismatch
    review       RC-2005                         property_missing
    review       RC-2006                         cert_not_found
    watch        RC-2008                         no_spec

▶ Explain RC-2002
  status: executed  decision: allow
  RC-2002: flag. Certificate MTR-1002 reports tensile_ksi 92; your spec is min 95.

▶ Write the report (CSV worklist and HTML page)
  status: executed  decision: allow
  Material certificates on receipts written: 8 receipt line(s), 4 certificate(s) on file: 3 missing, wrong lot or out of spec, 2 incomplete, 1 with no spec, 2 in order.

▶ Write the draft (Auto is opted in for drafts)
  status: executed  decision: allow  (auto)
  cert request North Example Metals drafted with 1 open marker(s) ([TO CONFIRM North Example Metals quality contact]). Nothing was sent.

▶ Auto: approving the draft stays one named click
  status: needs_approval  decision: ask
  reason: binding_send stays one-click, even in Auto

▶ Same call after the named click (recorded; a person acts on it)
  status: executed  decision: ask  approved by: Pat Planner (fictional)
  cert request North-Example-Metals approved and recorded. Nothing was sent or paid by the agent.

▶ The agent tries qms_release_hold itself
  status: blocked  decision: block
  reason: Never places or releases a quality hold on received material.
```

## Tools

| Tool | What it does | Policy |
|---|---|---|
| `certs_check` | For each receipt line of an item with a spec: flags a missing certificate where one is required, a certificate for another lot or heat and properties outside the spec min/max; reviews properties the certificate does n… | runs |
| `certs_explain` | Show one receipt line's figures and findings, from the same files as certs_check. | runs |
| `certs_write_report` | Write material-certs.csv (one row per receipt line, with a blank decision column for people to fill in) and material-certs.html into out_dir (default fairmake-out/certs). | runs |
| `certs_draft_cert_request` | Write drafts/cert_request-<supplier>.md: one supplier's receipts with missing, wrong-lot or out-of-spec certificates. | asks first (Auto can be opted in) |
| `certs_request_send` | After one named human click (even in Auto), record that the reviewed cert request draft is approved in cert_request-requests.csv. | one named click, even in Auto (`binding_send`) |
| `qms_release_hold` | Never places or releases a quality hold on received material. | refused |
| `ap_pay_invoice` | Never pays, holds or short-pays a supplier invoice. | refused |

Any tool name not in this table is blocked, including names a model invents. `refused` tools are listed so a model can see they exist and are refused.

## Columns it reads

Table inputs can be CSV, TSV, semicolon- or pipe-separated text, Excel `.xlsx`, JSON or JSONL. Columns are matched by the agent's own name, then by the English names below, then by their names in German, French, Spanish, Portuguese, Italian, Japanese, Chinese and Korean. Dates become `YYYY-MM-DD`; amounts are read with either decimal mark; weights, distances and dimensions are converted when the column says it holds kilograms, kilometres or centimetres. Every result lists under `sources` how each file was read.

### Receipt lines (`receipts`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `receipt` (required) | text | Receipt, Receipt Line, Receipt ID, GRN | Wareneingang, Réception, 入庫番号, 收货单号 |
| `item` (required) | text | Item, Part, Part Number, Material | Artikel, Article, 品目, 物料 |
| `lot` | text | Lot, Heat, Heat Number, Lot Number, Batch | Charge, Lot, ロット, 批次 |
| `supplier` | text | Supplier, Vendor, Mill | Lieferant, Fournisseur, 仕入先, 供应商 |
| `receipt_date` | date | Receipt Date, Received, Date | Eingangsdatum, Date de réception, 受領日, 收到日期 |
| `cert_id` | text | Cert ID, Cert Number, Certificate, MTR, CoC Number | - |

Named exports recognised by their column names:

| System | Export | Recognised by | Layout checked against vendor docs |
|---|---|---|---|
| Epicor Kinetic | Receipt entry lines export | Pack Slip, Supplier, Part, Lot | no |

Where a layout says "checked", its column names were compared with the vendor's documentation on that date. The other layouts were written from knowledge of the export and were not checked. None was tested against a live account.

### Certificate values (`certs`)

| Column | Type | Also read as | For example, in other languages |
|---|---|---|---|
| `cert_id` (required) | text | Cert ID, Cert Number, Certificate, MTR | - |
| `lot` | text | Lot, Heat, Heat Number, Lot Number | Charge, Lot, ロット, 批次 |
| `property` (required) | text | Property, Test, Characteristic, Parameter | - |
| `value` | number | Value, Result, Measured, Reading | - |

### Files from other countries

A German export in Windows-1252 with semicolons, `1.234,56` and `03.11.2026`, or a Japanese one in Shift_JIS with `2026/11/03`, is read the same way as the English file. [`fixtures/intl/`](fixtures/intl) has both versions of the demo data, and the eval cases `intl-de-*` and `intl-ja-*` require the same results as the English case. A weight, distance or dimension column found by its translated name with no unit in it is read as metric and converted, and the result says so. Columns named differently? Run `npx fairmake-material-certs inspect <file>` (names and shapes only, never values) and name them in `fairmake-sources.json`:

```json
{ "files": { "exports/bills.csv": { "columns": { "invoice_number": "Beleg" }, "date_order": "dmy", "units": { "weight": "kg" } } } }
```

## Install

Node 20 or newer. No other dependencies.

```bash
npx -y fairmake-material-certs demo
npx -y fairmake-material-certs mcp --root /path/to/your/files
```

Claude Desktop, Cursor and other MCP hosts:

```json
{
  "mcpServers": {
    "fairmake-material-certs": {
      "command": "npx",
      "args": [
        "-y",
        "fairmake-material-certs",
        "mcp",
        "--root",
        "/path/to/your/files"
      ]
    }
  }
}
```

Claude Code: `claude mcp add fairmake-material-certs -- npx -y fairmake-material-certs mcp --root .`, or install the `fairmake-material-certs` plugin from this repository's marketplace.

## Modes and approvals

- **Review** (`--mode review`): reads and reports only.
- **Assist** (default): the policy above. A tool that asks returns an `approval_id`; a person approves it once with `fairmake-material-certs approve <id> --as "Your Name"` (or on the local approvals page, `fairmake-material-certs approvals`), and the same call is repeated.
- **Auto** (`--mode auto --auto <tool,...>`): opt-in per tool, with step caps and a kill switch (`fairmake-material-certs kill`). Paying, sending, posting to a ledger or a live system and accepting a learned fact stay **one named click even in Auto**; an approval is tied to the sha256 of the reviewed draft, so a changed draft needs a new click.

## CLI

```bash
fairmake-material-certs tools                 # every tool, its policy and arguments
fairmake-material-certs sources               # the columns each input is read from
fairmake-material-certs inspect <file>        # how a file would be read (names and shapes, never values)
fairmake-material-certs call certs_check '{"receipts":"<receipts>","specs":"<specs>"}'
fairmake-material-certs eval                  # the private eval cases on the fictional fixtures
fairmake-material-certs demo
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
