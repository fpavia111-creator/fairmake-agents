# Fairmake NCR CAPA Aging fixtures

Fictional nonconformances and corrective actions, as of 2026-11-18; owner names are made up.

- `ncrs.csv`, `capas.csv`: three porosity NCRs on one housing with no CAPA (a repeat defect), one of them open for 78 days with no disposition; an NCR pointing at a CAPA that is not in the log; a closed NCR with no disposition; a CAPA past due; a CAPA with no root cause; a CAPA closed without a check that it worked; records in order.
- `settings.json`, `settings-loose.json`: default and looser limits.
- `exports/qms-ncr-log.csv`: generic QMS nonconformance log columns. Written from knowledge of such exports, not checked against a live system.
