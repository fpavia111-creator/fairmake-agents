// Landed cost: bills against allocations, freight-collect receipts with no bill, unmatched bills, outliers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landedCost, adjustmentText, DEFAULTS } from '../src/index.js';

const rc = (receipt, goods_value, landed_allocated = 0, supplier = 'Sup A') => ({ receipt, supplier, receipt_date: '2026-11-01', goods_value, landed_allocated });
const ch = (charge_id, receipt, amount, charge_type = 'Freight') => ({ charge_id, receipt, vendor: 'Carrier X', charge_type, amount, invoice_date: '2026-11-02' });
const run = (receipts, charges, s = DEFAULTS) => landedCost({ receipts, charges }, s);
const by = (r) => Object.fromEntries(r.items.map((i) => [i.reference, i.findings.map((f) => f.code)]));

test('billed landed cost not allocated into item cost is flagged at the gap', () => {
  const r = run([rc('R1', 1000, 10)], [ch('F1', 'R1', 50)]);
  assert.deepEqual(r.items[0].findings.map((f) => [f.code, f.amount]), [['not_allocated', 40]]); assert.equal(r.not_allocated, 40);
});

test('several bills on one receipt add up, and a small gap is ignored', () => {
  const r = run([rc('R1', 1000, 95)], [ch('F1', 'R1', 50), ch('D1', 'r1', 60, 'Duty')]);
  assert.equal(r.items[0].billed, 110); assert.deepEqual(by(r).R1, [], '15 is under the 25 minimum');
});

test('an allocation with no bill is reviewed; a freight-collect supplier with no bill is reviewed', () => {
  const r = run([rc('R1', 1000, 80), rc('R2', 1000, 0, 'Collect Co')], [], { ...DEFAULTS, collect_suppliers: ['Collect Co'] });
  assert.deepEqual(by(r), { R1: ['over_allocated'], R2: ['no_freight_bill'] });
  assert.deepEqual(by(run([rc('R2', 1000, 0, 'Collect Co')], [])), { R2: [] }, 'without the setting it is not expected');
});

test('a bill that names no receipt, or one not in the file, is reviewed at its amount', () => {
  const r = run([rc('R1', 1000, 0)], [ch('F1', 'R9', 70), ch('F2', '', 30)]);
  assert.deepEqual(r.unmatched_charges.map((u) => [u.reference, u.billed]), [['F1', 70], ['F2', 30]]); assert.equal(r.unmatched, 100);
});

test('a landed cost share far above the median is listed to watch', () => {
  const r = run([rc('A', 1000, 20), rc('B', 1000, 20), rc('C', 1000, 200)], [ch('1', 'A', 20), ch('2', 'B', 20), ch('3', 'C', 200)]);
  assert.deepEqual(by(r).C, ['landed_pct_outlier']); assert.equal(r.median_landed_pct, 2);
});

test('receipt lines of one receipt are summed', () => {
  const r = run([rc('R1', 600, 0), rc('R1', 400, 0)], [ch('F1', 'R1', 100)]);
  assert.equal(r.receipts, 1); assert.equal(r.items[0].goods_value, 1000); assert.equal(r.items[0].landed_pct, 10);
});

test('the adjustment draft lists only receipts with landed cost to allocate', () => {
  const r = run([rc('R1', 1000, 0), rc('R2', 1000, 50)], [ch('F1', 'R1', 100), ch('F2', 'R2', 50)]);
  const d = adjustmentText(r, {});
  assert.match(d, /\| R1 \| Sup A \| 1000 \| 100 \| 0 \| 100 \|/); assert.doesNotMatch(d, /\| R2 \|/); assert.match(d, /\[TO CONFIRM accountant/);
});
