# Fairmake EDI ASN Errors fixtures

Fictional customer POs, ASNs and shipment records.

- `orders.csv`, `asns.csv`, `shipments.csv`: an ASN sent two days after shipping that also lists more than ordered and more than shipped (PO-8002); an ASN with no SSCC (PO-8003); an ASN for an item not on the PO, reusing another ASN carton label (PO-8004, which also marks PO-8001); a shipment with no ASN (PO-8005); an ASN for a PO not in the file.
- `orders-and-asns.edi`, `shipments-edi.csv`: the same kind of check from an X12 file with two 850s, an 856 and an 810.
- `settings.json`, `settings-grace.json`: fines from a fictional compliance guide, and a longer grace with no fines.
- `exports/edi-asn-report.csv`: a generic EDI provider ASN report. Written from knowledge of such reports, not checked against a live account.
