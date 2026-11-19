# Fairmake EDI Invoice Check fixtures

Fictional customer POs and invoices.

- `orders.csv`, `invoices.csv`: a clean invoice; an invoice priced above the PO (INV-4002) and a second invoice with the same lines (INV-4007); partial invoices that end up over the PO quantity (INV-4003, INV-4004); an item not on the PO; a PO that does not exist.
- `orders-and-invoices.edi`: an X12 file with two 850s, an 856 and an 810 whose second line is priced above the PO.
- `settings.json`, `settings-loose.json`: price tolerance of one cent and of one dollar.
- `exports/qbe-sales-detail.csv`: QuickBooks Enterprise style sales detail. Written from knowledge of the report, not checked against a live file.
