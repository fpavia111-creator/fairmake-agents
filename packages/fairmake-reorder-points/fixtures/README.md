# Fairmake Reorder Points fixtures

Fictional stock status and 90 days of usage, as of 2026-11-18.

- `items.csv`, `usage.csv`: a bearing allocated past its stock (stockout) whose reorder point is also too low; a seal under safety stock and at its reorder point; bar stock at its reorder point with a reorder point too low for current usage; a gasket and a casting with reorder points far from usage; a plate with no reorder point; bolts and housings in line. One old usage row falls outside the 90-day window.
- `settings.json`, `settings-wide.json`: default and wider review thresholds.
- `exports/mrpeasy-stock-items.csv`: MRPeasy-style stock item columns. Written from knowledge of the export, not checked against a live account.
