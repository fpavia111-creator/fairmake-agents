# Fairmake BOM Cost Rollup fixtures

Fictional assemblies, components and prices in US dollars, measured as of 2026-11-18.

- `bom.csv`: a pump made of a housing (from a casting), an impeller (from bar with 5% scrap), seals and bolts; a valve with one component that has no price; two items that contain each other (a loop); a kit with no standard; a bracket whose plate price is from 2025.
- `prices.csv`: purchase prices (the casting has an older and a newer price; the newer one is used).
- `items.csv`: standard and conversion cost per unit.
- `settings.json`, `settings-wide.json`: default and wider thresholds.
- `exports/katana-recipes.csv`: the pump structure with Katana-style column names. Written from knowledge of the export, not checked against a live account.
