# Fairmake Obsolete Inventory fixtures

Fictional stock on hand, in US dollars, aged as of 2026-11-30.

- `inventory.csv`: an old valve with no movement for 17 months (obsolete), a gasket idle for 8 months (slow), bar stock with 50 months of supply (excess), a tiny obsolete line below the reserve minimum, a discontinued kit still in stock, a new seal with no movement data, a spring that never moved, and active items.
- `settings.json`, `settings-long.json`: default and longer horizons.
- `exports/qbe-inventory-valuation.csv`: QuickBooks Enterprise style valuation with a group row and a total row. Written from knowledge of the report, not checked against a live file.
