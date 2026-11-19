# Fairmake Shelf Life fixtures

Fictional lots and shipments, as of 2026-11-18.

- `lots.csv`, `shipments.csv`: an expired adhesive lot still on hand (L-2601); a lot expiring soon that was shipped to a retailer needing 90 days (L-2602, S-1); a newer adhesive lot shipped while an older one was in stock (L-2603, S-2); a seal kit with no expiry date; a lubricant lot shipped two days after it expired (L-2605, S-3); a paint lot shipped out of first-expired-first-out order (L-2608, S-4); clean lots.
- `settings.json`, `settings-strict.json`: default rules, and a 30-day minimum for every customer.
- `exports/fishbowl-lots.csv`: Fishbowl-style lot columns. Written from knowledge of the export, not checked against a live system.
