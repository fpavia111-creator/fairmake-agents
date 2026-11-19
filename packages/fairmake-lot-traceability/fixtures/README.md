# Fairmake Lot Traceability fixtures

Fictional lots, production issues and shipments.

- `receipts.csv`, `consumption.csv`, `shipments.csv`: a clean finished lot (FG-1001) used again as a subassembly; a finished lot built with a bolt lot issued before it was received and a seal issued with no lot (FG-1002); a lot whose gasket lot was never received (FG-1003); a work order with no finished lot; a serial shipped twice that was never produced; a shipment with no lot; a received lot resold as is.
- `exports/netsuite-assembly-components.csv`: NetSuite-style assembly build components. Written from knowledge of the export, not checked against a live account.
