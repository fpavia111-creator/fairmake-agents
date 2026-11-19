# Fairmake HTS Codes fixtures

Fictional items, customs entry lines and a code list. The tariff numbers are sample data for the checks, not a classification of anything.

- `items.csv`, `entries.csv`: an item with no code (CAS-310); a seal with no origin and a code not on the list; a malformed code; two items with the same description under different headings; an entry that declared a nut under the bolt code (E2-1); an entry with another origin (E2-2); an entry with a duty rate different from the list (E3-1); an entered item that is not in the item master.
- `settings.json`, `settings-nolist.json`: with and without a code list.
- `exports/acumatica-stock-items.csv`: Acumatica-style stock item columns. Written from knowledge of the export, not checked against a live system.
