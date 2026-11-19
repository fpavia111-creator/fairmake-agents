# Fairmake Calibration Due fixtures

Fictional gauges and gauge use, as of 2026-11-18.

- `gauges.csv`, `usage.csv`: a micrometer that failed calibration and was used twice afterwards (MIC-002); a caliper overdue and used past its due date (CAL-003); two gauges due soon; one never calibrated; one with no interval; an out-of-service CMM that is not chased; and gauges in calibration. Use before a failed calibration or before the due date is not suspect.
- `settings.json`, `settings-week.json`: thirty and seven days of look-ahead.
- `exports/calibration-register.csv`: generic calibration register columns. Written from knowledge of such exports, not checked against a live system.
