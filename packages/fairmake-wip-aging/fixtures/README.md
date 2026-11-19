# Fairmake WIP Aging fixtures

Fictional work orders aged as of 2026-11-30, WIP in US dollars.

- `work-orders.csv`: a stale order (WO-2003) and one with no activity since release (WO-2010), a closed order still holding WIP (WO-2004), negative WIP (WO-2006), an over-completed order (WO-2007), past-due orders (WO-2002, WO-2008), and clean ones.
- `settings.json`, `settings-slow.json`: default and slower stale limits and buckets.
- `exports/netsuite-work-orders.csv`: NetSuite-style saved search columns. Written from knowledge of the export, not checked against a live account.
