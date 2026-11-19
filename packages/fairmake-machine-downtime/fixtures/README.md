# Fairmake Machine Downtime fixtures

One fictional week of stops on fictional machines.

- `events.csv`, `schedule.csv`: CNC-2 below the availability target with a recurring spindle fault and a stop with no reason; PRESS-1 with two overlapping stops; WELD-1 with a stop that has no end; LASER-1 with no scheduled hours; CNC-1 fine (its planned maintenance does not count against availability).
- `settings.json`, `settings-low.json`: default and lower targets.
- `exports/mes-downtime.csv`: generic MES downtime columns. Written from knowledge of such exports, not checked against a live system.
