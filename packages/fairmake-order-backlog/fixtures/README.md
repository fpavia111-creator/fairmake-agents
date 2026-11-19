# Fairmake Order Backlog fixtures

Fictional open sales order lines, as of 2026-11-18, in US dollars.

- `orders.csv`: two lines past their promise date (SO-501-1, SO-504-1); a promise later than the customer asked (SO-502-1); a line due this week; a line never promised; a line on credit hold; lines on schedule; a fully shipped line and a cancelled line that are left out.
- `settings.json`, `settings-tight.json`: one week and one day of look-ahead.
- `exports/netsuite-open-sales-orders.csv`: NetSuite-style open sales order lines. Written from knowledge of the export, not checked against a live account.
