# Fairmake Purchase Price Variance fixtures

Fictional receipt lines from fictional suppliers, in US dollars.

- `receipts.csv`: twelve receipt lines: one bar steel item creeping up over three receipts (a price jump and a standard to review), a screw received at 6.00 against a 0.05 standard (a unit-of-measure slip), a plate well under standard twice, a gasket with no standard, a casting whose price jumped, and clean lines.
- `settings.json`, `settings-tight.json`: default and tighter tolerances.
- `exports/sap-b1-grpo.csv`: SAP Business One style goods receipt rows. Written from knowledge of the export, not checked against a live system.
