# Fairmake BOM Routing Gaps fixtures

A fictional item master, BOMs and routings.

- `items.csv`, `bom.csv`, `routings.csv`: a complete pump; a frame with an obsolete component, a zero quantity and a step with no work center; a guard with no BOM; a panel with no routing; a cart with an unknown component and a step with no time; a bought seal that carries a BOM; two items that contain each other; a kit missing from the item master; an obsolete assembly that is skipped.
- `settings.json`, `settings-words.json`: the type words, and a shop that calls made items Produced.
- `exports/mrpeasy-boms.csv`: MRPeasy-style BOM columns. Written from knowledge of the export, not checked against a live account.
