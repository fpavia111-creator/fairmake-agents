// Overhead absorption: applied against actual, tolerance, volume, missing rate or actual, proposed rates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { absorption, rateText, DEFAULTS } from '../src/index.js';

const run = (hours, rates, actuals, s = DEFAULTS) => absorption({ hours, rates, actuals }, s);
const h = (work_center, hours, period = '2026-11') => ({ work_center, period, hours });
const rt = (work_center, rate, budget_hours = null) => ({ work_center, rate, budget_hours });
const ac = (work_center, actual_overhead, period = '2026-11') => ({ work_center, period, actual_overhead });

test('applied is hours times rate; under-absorption past the tolerance is flagged at its amount', () => {
  const r = run([h('CNC', 100)], [rt('CNC', 50)], [ac('CNC', 6000)]);
  assert.equal(r.items[0].applied, 5000); assert.deepEqual(r.items[0].findings.map((f) => [f.code, f.amount]), [['under_absorbed', 1000]]);
  assert.equal(r.items[0].proposed_rate, 60);
});

test('inside the tolerance is ok; over-absorption is listed to watch', () => {
  assert.equal(run([h('A', 100)], [rt('A', 50)], [ac('A', 5200)]).items[0].status, 'ok');
  const over = run([h('A', 100)], [rt('A', 50)], [ac('A', 4000)]).items[0];
  assert.equal(over.status, 'watch'); assert.equal(over.findings[0].code, 'over_absorbed');
});

test('hours and actuals from several rows and periods are summed, in any order', () => {
  const rows = [h('A', 40, '2026-10'), h('a', 60, '2026-11')];
  const r = run(rows, [rt('A', 10)], [ac('A', 500, '2026-10'), ac('A', 500, '2026-11')]);
  assert.equal(r.items.length, 1); assert.equal(r.items[0].hours, 100); assert.equal(r.items[0].actual, 1000); assert.equal(r.items[0].status, 'ok');
});

test('hours well below budget are a volume shortfall', () => {
  const r = run([h('A', 70)], [rt('A', 10, 100)], [ac('A', 700)]);
  assert.deepEqual(r.items[0].findings.map((f) => f.code), ['low_volume']);
  assert.deepEqual(run([h('A', 70)], [rt('A', 10, 100)], [ac('A', 700)], { ...DEFAULTS, volume_pct: 40 }).items[0].findings, []);
});

test('hours with no rate, or a rate with no actual spend, are reviewed', () => {
  const r = run([h('A', 10), h('B', 10)], [rt('B', 5)], [ac('A', 100)]);
  assert.deepEqual(r.items.map((i) => [i.work_center, i.findings.map((f) => f.code)]), [['A', ['no_rate']], ['B', ['no_actual']]]);
});

test('a work center only in the actuals file still appears', () => {
  const r = run([], [], [ac('MAINT', 900)]);
  assert.equal(r.work_centers, 1); assert.equal(r.items[0].actual, 900);
});

test('the rate proposal lists the work centers past the tolerance only', () => {
  const r = run([h('A', 100), h('B', 100)], [rt('A', 50), rt('B', 50)], [ac('A', 6000), ac('B', 5000)]);
  const d = rateText(r, {});
  assert.match(d, /\| A \| 50 \| 60 \| 100 \|/); assert.doesNotMatch(d, /\| B \|/); assert.match(d, /\[TO CONFIRM controller/);
});
