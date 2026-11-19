# Fairmake Scrap Yield fixtures

Fictional production counts and standard scrap rates.

- `production.csv`: porosity scrap on a housing far above standard (WO-4002), scrap with no reason (WO-4003), counts that do not add up (WO-4004), scrap above standard but below the minimum cost (WO-4005, WO-4010), more good parts than started (WO-4006), a work order on two rows with die wear (WO-4008), and clean orders.
- `standards.csv`: standard scrap % per item; SHF-400 has none and uses the default.
- `settings.json`, `settings-strict.json`: default and strict settings.
- `exports/mes-production-counts.csv`: generic MES good and reject counts. Written from knowledge of such exports, not checked against a live system.
