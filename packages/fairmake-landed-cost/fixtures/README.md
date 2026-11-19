# Fairmake Landed Cost fixtures

Fictional receipts and freight, duty and brokerage bills, in US dollars.

- `receipts.csv`, `charges.csv`: freight billed and not allocated (RCV-701), an import with duty, brokerage and ocean freight partly allocated (RCV-703), a freight-collect supplier with no freight bill (RCV-704), an allocation with no bill (RCV-705), an expensive expedited shipment (RCV-707), a bill naming a receipt that is not in the file and one naming none, and clean receipts.
- `settings.json`, `settings-wide.json`: default and wider tolerances (the default names one freight-collect supplier).
- `exports/acumatica-receipts.csv`: Acumatica-style receipt lines (two lines of one receipt). Written from knowledge of the export, not checked against a live system.
