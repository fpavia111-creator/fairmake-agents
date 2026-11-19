// Machine downtime: availability from unplanned stops, MTTR and MTBF, chronic reasons, data problems.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { machineDowntime, maintenanceRequestText, DEFAULTS } from '../src/index.js';

const ev = (event, machine, start, end, reason = 'Jam', planned = 'N') => ({ event, machine, start, end, reason, planned });
const run = (events, schedule, s = DEFAULTS) => machineDowntime({ events, schedule }, s);
const by = (r) => Object.fromEntries(r.items.map((i) => [i.machine, i.findings.map((f) => f.code)]));

test('availability counts unplanned stops only; MTTR and MTBF come from them', () => {
  const r = run([ev('1', 'M', '2026-11-02T08:00', '2026-11-02T12:00'), ev('2', 'M', '2026-11-03T08:00', '2026-11-03T10:00', 'PM', 'Yes')], [{ machine: 'M', scheduled_hours: 40 }]);
  const m = r.items[0];
  assert.equal(m.unplanned_hours, 4); assert.equal(m.downtime_hours, 6); assert.equal(m.availability_pct, 90); assert.equal(m.mttr_hours, 4); assert.equal(m.mtbf_hours, 36);
  assert.deepEqual(by(r), { M: [] });
});

test('below the availability target is flagged', () => {
  const r = run([ev('1', 'M', '2026-11-02T08:00', '2026-11-02T16:00')], [{ machine: 'M', scheduled_hours: 40 }]);
  assert.deepEqual(by(r), { M: ['low_availability'] });
  assert.deepEqual(by(run([ev('1', 'M', '2026-11-02T08:00', '2026-11-02T16:00')], [{ machine: 'M', scheduled_hours: 40 }], { ...DEFAULTS, min_availability_pct: 75 })), { M: [] });
});

test('a reason seen the chronic number of times is watched, whatever the letter case', () => {
  const evs = [ev('1', 'M', '2026-11-02T08:00', '2026-11-02T08:30', 'Jam'), ev('2', 'M', '2026-11-03T08:00', '2026-11-03T08:30', 'jam'), ev('3', 'M', '2026-11-04T08:00', '2026-11-04T08:30', 'JAM ')];
  assert.deepEqual(by(run(evs, [{ machine: 'M', scheduled_hours: 100 }])), { M: ['chronic_reason'] });
});

test('stops with no reason, no end, or overlapping another are reviewed', () => {
  const r = run([ev('1', 'M', '2026-11-02T08:00', '2026-11-02T10:00', ''), ev('2', 'M', '2026-11-02T09:00', '2026-11-02T11:00'), ev('3', 'M', '2026-11-03T08:00', '')], [{ machine: 'M', scheduled_hours: 100 }]);
  assert.deepEqual(by(r).M, ['no_reason', 'open_event', 'overlapping_events']);
});

test('a machine with stops and no scheduled hours is reviewed; one with hours and no stops is fine', () => {
  assert.deepEqual(by(run([ev('1', 'X', '2026-11-02T08:00', '2026-11-02T09:00')], [{ machine: 'Y', scheduled_hours: 10 }])), { X: ['no_schedule'], Y: [] });
});

test('totals by reason separate planned from unplanned', () => {
  const r = run([ev('1', 'M', '2026-11-02T08:00', '2026-11-02T09:00', 'PM', 'Y'), ev('2', 'M', '2026-11-02T10:00', '2026-11-02T12:00', 'Jam')], [{ machine: 'M', scheduled_hours: 40 }]);
  assert.deepEqual(r.by_reason.map((x) => [x.reason, x.planned, x.hours]), [['Jam', 'no', 2], ['PM', 'yes', 1]]);
});

test('the maintenance request lists machines below target or with chronic reasons', () => {
  const r = run([ev('1', 'A', '2026-11-02T08:00', '2026-11-02T16:00'), ev('2', 'B', '2026-11-02T08:00', '2026-11-02T08:10')], [{ machine: 'A', scheduled_hours: 40 }, { machine: 'B', scheduled_hours: 40 }]);
  const d = maintenanceRequestText(r, {}); assert.match(d, /\| A \|/); assert.doesNotMatch(d, /\| B \|/); assert.match(d, /\[TO CONFIRM maintenance lead\]/);
});
