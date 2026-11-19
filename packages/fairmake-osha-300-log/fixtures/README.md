# Fairmake OSHA 300 Log fixtures

Fictional injury and illness cases at a fictional plant in 2026; every name is made up.

- `cases.csv`: a complete case and a closed days-away case; a restriction case with no days and no return date; days away on a case whose outcome says otherwise, entered late; a privacy case with a name entered and no days; a case missing its job title and location; a long days-away case over the cap and still open; a first-aid case marked recordable.
- `settings.json`, `settings-nohours.json`: with annual hours (rates computed) and without.
- `exports/ehs-incident-log.csv`: generic EHS incident log columns. Written from knowledge of such exports, not checked against a live system.
