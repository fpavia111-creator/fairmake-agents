// Cycle counts: class tolerances with a value floor, missing counts, negative stock, repeat variances, accuracy by class.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cycleCounts, adjustmentText, DEFAULTS } from '../src/index.js';

const c = (over = {}) => ({ count_id: 'C1', item: 'A1', location: 'B1', count_date: '2026-11-01', system_qty: 100, counted_qty: 100, unit_cost: 50, abc_class: 'A', ...over });
const run = (rows, s = DEFAULTS) => cycleCounts(rows, s);
const codes = (r, i = 0) => r.items[i].findings.map((f) => f.code);

test('a variance over the class tolerance and the value floor is flagged at its absolute value', () => {
  const r = run([c({ counted_qty: 95 })]);
  assert.deepEqual(r.items[0].findings.map((f) => [f.code, f.amount]), [['out_of_tolerance', 250]]);
});

test('class C tolerates more than class A; a small value is within tolerance whatever the percentage', () => {
  assert.deepEqual(codes(run([c({ counted_qty: 95, abc_class: 'C' })])), []);
  assert.deepEqual(codes(run([c({ counted_qty: 50, unit_cost: 1 })])), []);
  assert.deepEqual(codes(run([c({ counted_qty: 94, abc_class: '' })])), ['out_of_tolerance'], 'no class uses the 5% default');
});

test('a line with no count is reviewed and kept out of accuracy', () => {
  const r = run([c({ counted_qty: null }), c({ count_id: 'C2' })]);
  assert.deepEqual(codes(r), ['not_counted']); assert.equal(r.counted, 1); assert.equal(r.accuracy_pct, 100);
});

test('negative system stock is reviewed', () => {
  assert.deepEqual(codes(run([c({ system_qty: -5, counted_qty: 0, unit_cost: 1 })])), ['negative_system']);
});

test('the same item varying on two counts is a repeat variance on each', () => {
  const r = run([c({ counted_qty: 99, unit_cost: 1 }), c({ count_id: 'C2', location: 'B2', counted_qty: 101, unit_cost: 1 })]);
  assert.deepEqual(r.items.map((i) => i.findings.map((f) => f.code)), [['repeat_variance'], ['repeat_variance']]);
});

test('accuracy and value by class', () => {
  const r = run([c({ counted_qty: 95 }), c({ count_id: 'C2', item: 'B1', abc_class: 'B' })]);
  assert.deepEqual(r.by_class.map((x) => [x.class, x.lines, x.accuracy_pct, x.net_value]), [['A', 1, 0, -250], ['B', 1, 100, 0]]);
});

test('the adjustment draft lists out-of-tolerance lines only and asks for a recount first', () => {
  const r = run([c({ counted_qty: 95 }), c({ count_id: 'C2', item: 'B1' })]);
  const d = adjustmentText(r, {}); assert.match(d, /\| C1 \| A1 \| B1 \| 100 \| 95 \| -5 \| -250 \|/); assert.doesNotMatch(d, /\| C2 \|/); assert.match(d, /Recount each line/);
});
