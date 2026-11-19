// Capacity load: weeks by due date, available hours, overload and watch levels, past-due load, horizon, calendars.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capacityLoad, capacityReviewText, DEFAULTS } from '../src/index.js';

const op = (work_order, work_center, due_date, hours_remaining) => ({ work_order, operation: '10', work_center, due_date, hours_remaining });
const cal = (work_center, hours_per_day = 8, days_per_week = 5, efficiency_pct = 100) => ({ work_center, hours_per_day, days_per_week, efficiency_pct });
const run = (operations, calendar, s = DEFAULTS) => capacityLoad({ operations, calendar }, s, '2026-11-18');
const by = (r) => Object.fromEntries(r.items.map((i) => [i.work_center, i.findings.map((f) => f.code)]));

test('available hours are hours per day times days times efficiency', () => {
  assert.equal(run([], [cal('A', 10, 5, 80)]).items[0].available_per_week, 40);
});

test('hours land in the week of their due date and a week over 100% is overloaded', () => {
  const r = run([op('W1', 'A', '2026-11-19', 30), op('W2', 'A', '2026-11-20', 15)], [cal('A')]);
  assert.deepEqual(by(r), { A: ['overloaded_week'] });
  assert.deepEqual(r.by_week.filter((w) => w.load).map((w) => [w.week, w.load, w.load_pct]), [['2026-11-16', 45, 112.5]]);
});

test('a week between the watch level and 100% is near capacity', () => {
  assert.deepEqual(by(run([op('W1', 'A', '2026-11-26', 38)], [cal('A')])), { A: ['near_capacity'] });
});

test('past-due operations load the first week and are reviewed', () => {
  const r = run([op('W1', 'A', '2026-11-02', 10)], [cal('A')]);
  assert.deepEqual(by(r), { A: ['past_due_load'] }); assert.equal(r.by_week[0].load, 10);
});

test('hours beyond the horizon are counted apart, not loaded', () => {
  const r = run([op('W1', 'A', '2027-03-01', 100)], [cal('A')]);
  assert.deepEqual(by(r), { A: [] }); assert.equal(r.items[0].beyond_horizon_hours, 100);
});

test('a work center with load and no calendar is reviewed; the overload limit comes from settings', () => {
  assert.deepEqual(by(run([op('W1', 'B', '2026-11-19', 5)], [])), { B: ['no_calendar'] });
  assert.deepEqual(by(run([op('W1', 'A', '2026-11-19', 45)], [cal('A')], { ...DEFAULTS, overload_pct: 120, watch_pct: 110 })), { A: ['near_capacity'] });
});

test('the review lists work centers that need a decision and says customer dates are not changed', () => {
  const r = run([op('W1', 'A', '2026-11-19', 50), op('W2', 'B', '2026-11-19', 5)], [cal('A'), cal('B')]);
  const d = capacityReviewText(r, {});
  assert.match(d, /\| A \|/); assert.doesNotMatch(d, /\| B \|/); assert.match(d, /Customer dates are not changed/);
});
