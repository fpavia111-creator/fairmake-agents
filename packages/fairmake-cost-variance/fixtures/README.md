# Fairmake Cost Variance fixtures

Fictional work orders at a fictional machine shop, measured in US dollars.

- `work-orders.csv`: ten work orders (WO-1007 on two rows, summed): a material overrun (WO-1002), labor and overhead overruns (WO-1003, WO-1010), a cost well under standard (WO-1004), a work order with no standard (WO-1005), one closed with cost and no output (WO-1006), and four within tolerance, two of them just inside the amount or the percentage tolerance (WO-1008, WO-1009).
- `settings.json`, `settings-loose.json`: the default tolerances, and looser ones.
- `exports/epicor-job-cost.csv`: three jobs with Epicor-style column names. Written from knowledge of the export, not checked against a live system.
