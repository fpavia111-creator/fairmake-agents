# Fairmake Late Purchase Orders fixtures

Fictional open PO lines, as of 2026-11-18, in US dollars.

- `po-lines.csv`: bar stock past its promise (PO-601-1); a promise after production needs the part (PO-601-2); a line never confirmed (PO-602-1); a partial receipt past due (PO-603-1); a promise later than requested (PO-603-2); an over-receipt (PO-604-2); a line one day late (PO-606-1); a fresh order not yet confirmed and clean lines.
- `settings.json`, `settings-grace.json`: default rules and a week of grace.
- `exports/sap-b1-open-po.csv`: SAP Business One open items columns. Written from knowledge of the export, not checked against a live system.
