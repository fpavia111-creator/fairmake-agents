# Fairmake Preventive Maintenance fixtures

Fictional PM tasks on fictional machines, as of 2026-11-18.

- `pm-schedule.csv`, `completions.csv`: a safety-critical inspection overdue (PM-102); a light curtain test that looks overdue in the schedule but was done on 2026-11-12 per the completion log (PM-103); an oil change due by date but over its run hours (PM-104); a task never done (PM-105); one with no interval (PM-106); two due soon; three on schedule.
- `settings.json`, `settings-month.json`: two weeks and a month of look-ahead.
- `exports/cmms-pm-schedule.csv`: generic CMMS columns. Written from knowledge of such exports, not checked against a live system.
