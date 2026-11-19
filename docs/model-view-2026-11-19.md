# What reaches the AI model (2026-11-19)

Made by `node scripts/model-view.mjs`: each check is run on its fictional fixtures and every fixture value is looked for in the JSON result the assistant's model receives. Masked columns (people's names) are replaced by tokens such as `A.R.#3f9a2c` (the same name always gives the same token, so the model can still group by it; the report and draft files on your machine keep the real values). Everything else in the result is sent in clear: amounts, quantities, dates, rates, finding codes and the text columns listed, including supplier and customer company names. Free-text columns (descriptions, reasons, root causes, job titles, locations) are sent as typed: if a person writes a colleague's name or a health detail into one, the model sees it.

The result goes to whatever model the user's assistant uses. For injury and illness records, staff time and pricing you treat as confidential, use a model covered by your own agreements or a local model. No compliance claim is made.

| Agent | Masked | Text sent in clear | Free text among them |
|---|---|---|---|
| fairmake-bom-cost-rollup | - | component, item, parent | - |
| fairmake-bom-routing-gaps | - | component, item, item_type, parent | - |
| fairmake-calibration-due | - | cal_result, description, gauge, gauge_status, location, work_order | description, location |
| fairmake-capacity-load | - | work_center | - |
| fairmake-cost-variance | - | item, wo_status, work_order | - |
| fairmake-cycle-counts | - | count_id, item, location | location |
| fairmake-edi-asn-errors | - | asn, item, po_number | - |
| fairmake-edi-invoice-check | - | invoice, item, po_number | - |
| fairmake-hts-codes | - | description, entry_line, item, supplier | description |
| fairmake-job-margins | estimator | customer, job, job_status | - |
| fairmake-labor-efficiency | employee | work_center, work_order | - |
| fairmake-landed-cost | - | charge_id, charge_type, receipt, supplier, vendor | - |
| fairmake-late-purchase-orders | - | item, po_line, po_number, supplier | - |
| fairmake-lot-traceability | - | component, component_lot, customer, finished_lot, item, lot, lot_or_serial, work_order | - |
| fairmake-machine-downtime | - | event, machine, reason | reason |
| fairmake-material-certs | - | cert_id, item, lot, property, receipt, supplier | - |
| fairmake-ncr-capa-aging | owner | capa, defect_code, ncr, part | defect_code |
| fairmake-obsolete-inventory | - | description, item | description |
| fairmake-order-backlog | - | customer, item, line_status, order_line, order_number | - |
| fairmake-osha-300-log | employee, job_title | case_number, outcome | - |
| fairmake-overhead-absorption | - | work_center | - |
| fairmake-preventive-maintenance | - | asset, description, task | description |
| fairmake-purchase-price-variance | - | item, po_number, receipt, supplier | - |
| fairmake-rebate-claims | - | agreement, item, supplier | - |
| fairmake-reorder-points | - | item | - |
| fairmake-retailer-deductions | - | customer, deduction, invoice, reason_code, reference | - |
| fairmake-scrap-yield | - | item, scrap_reason, work_center, work_order | scrap_reason |
| fairmake-shelf-life | - | customer, item, location, lot, shipment | location |
| fairmake-supplier-scorecards | - | supplier | - |
| fairmake-wip-aging | - | item, wo_status, work_order | - |
