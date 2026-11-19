// Scrap and yield: standards and defaults, the alert factor, the minimum, reasons, counts, roll-ups.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrapYield, scrapReviewText, DEFAULTS } from '../src/index.js';

const p = (over = {}) => ({ work_order: 'W1', item: 'A', work_center: 'CNC', prod_date: '2026-11-01', qty_started: 100, qty_good: 95, qty_scrap: 5, unit_cost: 50, scrap_reason: 'Burr', ...over });
const run = (production, standards = [], s = DEFAULTS) => scrapYield({ production, standards }, s);
const codes = (r) => r.items[0].findings.map((f) => f.code);

test('scrap above the standard times the factor is flagged at the cost of the excess', () => {
  const r = run([p({ qty_good: 88, qty_scrap: 12 })], [{ item: 'A', std_scrap_pct: 4 }]);
  assert.deepEqual(r.items[0].findings.map((f) => [f.code, f.amount]), [['scrap_over_standard', 400]]);
  assert.deepEqual(codes(run([p()], [{ item: 'A', std_scrap_pct: 4 }])), [], '5% is under 4% times 1.5');
});

test('items without a standard use the default, and small excess is under the minimum', () => {
  assert.deepEqual(codes(run([p()])), ['scrap_over_standard'], '5% against the 3% default times 1.5 = 4.5%');
  assert.deepEqual(codes(run([p({ unit_cost: 1 })])), [], '2 parts at 1 is under the 50 minimum');
});

test('scrap with no reason, and counts that do not add up, are reviewed', () => {
  assert.deepEqual(codes(run([p({ scrap_reason: '' })], [{ item: 'A', std_scrap_pct: 10 }])), ['no_reason']);
  assert.deepEqual(codes(run([p({ qty_good: 90 })], [{ item: 'A', std_scrap_pct: 10 }])), ['qty_mismatch']);
  assert.deepEqual(codes(run([p({ qty_good: 101, qty_scrap: 0 })])), ['yield_over_100']);
});

test('with no started quantity, started is good plus scrap', () => {
  const r = run([p({ qty_started: null })], [{ item: 'A', std_scrap_pct: 10 }]);
  assert.equal(r.items[0].started, 100); assert.deepEqual(codes(r), []);
});

test('rows of one work order are summed and their reasons listed', () => {
  const r = run([p({ qty_started: 50, qty_good: 48, qty_scrap: 2, scrap_reason: 'Burr' }), p({ qty_started: 50, qty_good: 47, qty_scrap: 3, scrap_reason: 'Crack' })], [{ item: 'A', std_scrap_pct: 10 }]);
  assert.equal(r.work_orders, 1); assert.equal(r.items[0].scrap, 5); assert.equal(r.items[0].reasons, 'Burr; Crack');
});

test('scrap rolls up by work center and by reason, costliest first', () => {
  const r = run([p(), p({ work_order: 'W2', work_center: 'LATHE', qty_scrap: 1, qty_good: 99, scrap_reason: 'Crack' })], [{ item: 'A', std_scrap_pct: 10 }]);
  assert.deepEqual(r.by_work_center.map((w) => [w.work_center, w.scrap_cost]), [['CNC', 250], ['LATHE', 50]]);
  assert.deepEqual(r.by_reason.map((w) => [w.reason, w.scrap]), [['Burr', 5], ['Crack', 1]]);
});

test('the review draft lists orders to act on or review only', () => {
  const r = run([p({ qty_good: 80, qty_scrap: 20 }), p({ work_order: 'W2', qty_scrap: 1, qty_good: 99 })]);
  const d = scrapReviewText(r, {});
  assert.match(d, /\| W1 \|/); assert.doesNotMatch(d, /\| W2 \|/); assert.match(d, /\[TO CONFIRM quality manager\]/);
});
