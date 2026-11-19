# Fairmake Rebate Claims fixtures

Fictional agreements and purchase lines, as of 2026-11-18, in US dollars.

- `agreements.json`: a steel supplier volume rebate whose period ended with part of the rebate still unclaimed and the claim-by date passed (NWM-2026); a fastener price agreement with an agreed price and a rebate still accruing (FEC-2026); a seal agreement close to its next tier (DSI-2026); last year, settled (SSS-2025).
- `purchases.csv`, `claims.csv`: the purchase lines and the credits already received; one line is paid above the agreed price, two fall outside their agreement dates.
- `settings.json`, `settings-close.json`: near-tier window of 10 and 5 percent.
- `exports/netsuite-purchase-lines.csv`: NetSuite-style purchase lines. Written from knowledge of the export, not checked against a live account.
