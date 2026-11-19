# Fairmake Retailer Deductions fixtures

Fictional deductions from fictional retailers and the shipment records behind them, as of 2026-11-18.

- `deductions.csv`, `shipments.csv`: a late-ASN fine where the ASN went 2.5 hours after shipping, and a shortage with a clean POD and full quantity (both disputable, D-9001 and D-9002); one disputable fine whose window has closed (D-9004); an ASN that really was late (D-9006); label, price and promotion deductions that need documents; an unknown reason code with no invoice; a promotion on an invoice that is not in the shipment file.
- `settings.json`, `settings-strict.json`: dispute windows by retailer, and a stricter ASN rule.
- `exports/retailer-remittance.csv`: a generic retailer remittance with negative deduction amounts. Written from knowledge of such portals, not checked against a live account.
