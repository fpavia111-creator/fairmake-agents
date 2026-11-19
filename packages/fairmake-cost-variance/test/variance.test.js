// Work order variances: tolerances, element findings, missing standards, closed with no output, the review draft.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costVariance, reviewText, DEFAULTS } from '../src/index.js';

const wo = (over = {}) => ({ work_order: 'WO-1', item: 'P1', wo_status: 'Closed', qty_completed: 10, std_material: 1000, act_material: 1000, std_labor: 500, act_labor: 500, std_overhead: 200, act_overhead: 200, ...over });
const run = (rows, s = DEFAULTS) => costVariance(rows, s);
const codes = (r, i = 0) => r.items[i].findings.map((f) => f.code);

test('an element is over only when both the percentage and the amount tolerance are exceeded', () => {
  assert.deepEqual(codes(run([wo({ act_material: 1300 })])), ['material_over']);
  assert.deepEqual(codes(run([wo({ act_material: 1200 })])), [], '200 is under the 250 amount tolerance');
  assert.deepEqual(codes(run([wo({ std_material: 10000, act_material: 10400 })])), [], '4% is under the 5% tolerance');
  assert.equal(run([wo({ act_material: 1300 })]).items[0].findings[0].amount, 300);
});

test('labor and overhead are checked on their own, and a work order can carry both', () => {
  const r = run([wo({ act_labor: 900, act_overhead: 500 })]);
  assert.deepEqual(codes(r), ['labor_over', 'overhead_over']); assert.equal(r.items[0].status, 'flag'); assert.equal(r.flagged_over, 700);
});

test('a work order with no standard is reviewed, not flagged; a large favorable variance is reviewed', () => {
  const none = run([wo({ std_material: 0, std_labor: 0, std_overhead: 0, act_material: 400 })]);
  assert.deepEqual(codes(none), ['no_standard']); assert.equal(none.items[0].status, 'review');
  const fav = run([wo({ act_material: 600, act_labor: 300 })]);
  assert.deepEqual(codes(fav), ['large_favorable']); assert.equal(fav.items[0].status, 'review');
});

test('closed with cost and nothing completed is flagged at the whole cost; an open one is not', () => {
  const r = run([wo({ qty_completed: 0 })]);
  assert.deepEqual(codes(r), ['cost_no_output']); assert.equal(r.items[0].findings[0].amount, 1700);
  assert.deepEqual(codes(run([wo({ qty_completed: 0, wo_status: 'Released' })])), []);
});

test('rows of the same work order are summed, whatever the letter case of its number', () => {
  const r = run([wo({ act_material: 600, std_material: 500, std_labor: 250, act_labor: 250, std_overhead: 100, act_overhead: 100 }), wo({ work_order: 'wo-1', std_material: 500, act_material: 500, std_labor: 250, act_labor: 250, std_overhead: 100, act_overhead: 100 })]);
  assert.equal(r.work_orders, 1); assert.equal(r.items[0].standard, 1700); assert.equal(r.items[0].actual, 1800);
  assert.deepEqual(codes(r), [], '100 over is inside the tolerance once the rows are summed');
});

test('settings change the tolerances and the result says which were used', () => {
  const rows = [wo({ act_material: 1300 })];
  assert.equal(run(rows, { ...DEFAULTS, tolerance_pct: 50 }).flag, 0);
  assert.equal(run(rows, { ...DEFAULTS, tolerance_amount: 400 }).flag, 0);
  assert.equal(run(rows).flag, 1);
});

test('totals by element add up, and the review draft lists only the work orders that need a look', () => {
  const r = run([wo({ act_material: 1300 }), wo({ work_order: 'WO-2' }), wo({ work_order: 'WO-3', std_material: 0, std_labor: 0, std_overhead: 0 })]);
  assert.deepEqual(r.by_element.map((e) => [e.element, e.variance]), [['material', 1300], ['labor', 500], ['overhead', 200]]);
  const d = reviewText(r, {});
  assert.match(d, /\[TO CONFIRM production manager or plant controller\]/); assert.match(d, /\| WO-1 \| P1 \| material_over \| 300 \|/); assert.match(d, /WO-3/); assert.doesNotMatch(d, /\| WO-2 \|/);
});
