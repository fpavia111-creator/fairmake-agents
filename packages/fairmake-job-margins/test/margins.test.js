// Job margins: losses, overruns, under-billing, targets, quotes missing, roll-ups, masking of estimators.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobMargins, requoteText, DEFAULTS } from '../src/index.js';

const job = (over = {}) => ({ job: 'J1', customer: 'Cust A', estimator: 'Est One', quoted_price: 1000, quoted_cost: 700, actual_cost: 700, invoiced: 1000, job_status: 'Closed', ...over });
const run = (rows, s = DEFAULTS) => jobMargins(rows, s);
const codes = (r) => r.items[0].findings.map((f) => f.code);

test('a job invoiced below its actual cost is a loss at the difference', () => {
  const r = run([job({ actual_cost: 1100 })]);
  assert.deepEqual(r.items[0].findings.map((f) => [f.code, f.amount]), [['loss', 100], ['cost_overrun', 400]]);
});

test('an overrun needs both the percentage and the minimum amount', () => {
  assert.deepEqual(codes(run([job({ actual_cost: 810 })])), ['cost_overrun', 'below_target']);
  assert.deepEqual(codes(run([job({ actual_cost: 760 })])), [], '8.6% is inside 10%');
  assert.deepEqual(codes(run([job({ quoted_cost: 70, actual_cost: 140, quoted_price: 1000 })])), [], '70 is under the 100 minimum');
});

test('a closed job invoiced below its quote is under-billed; an open one is not', () => {
  assert.deepEqual(run([job({ invoiced: 800, quoted_cost: 500, actual_cost: 500 })]).items[0].findings.map((f) => [f.code, f.amount]), [['under_billed', 200]]);
  assert.deepEqual(codes(run([job({ invoiced: 800, quoted_cost: 500, actual_cost: 500, job_status: 'Open' })])), []);
});

test('margin under target is listed to watch; until invoiced the quoted price is the revenue', () => {
  assert.deepEqual(codes(run([job({ actual_cost: 750, quoted_cost: 750 })])), []);
  assert.deepEqual(codes(run([job({ actual_cost: 850, quoted_cost: 800 })])), ['below_target']);
  assert.equal(run([job({ invoiced: null, job_status: 'Open' })]).items[0].margin, 300);
});

test('a job with no quote is reviewed', () => {
  assert.deepEqual(codes(run([job({ quoted_price: null, quoted_cost: null })])), ['no_quote']);
});

test('margins roll up by customer and estimator, worst first', () => {
  const r = run([job(), job({ job: 'J2', customer: 'Cust B', estimator: 'Est Two', actual_cost: 1200 })]);
  assert.deepEqual(r.by_customer.map((c) => [c.customer, c.margin]), [['Cust B', -200], ['Cust A', 300]]);
  assert.deepEqual(r.by_estimator.map((c) => [c.estimator, c.overruns]), [['Est Two', 1], ['Est One', 0]]);
});

test('the note to estimating lists the flagged jobs only', () => {
  const r = run([job(), job({ job: 'J2', actual_cost: 1200 })]);
  const d = requoteText(r, {});
  assert.match(d, /\| J2 \|/); assert.doesNotMatch(d, /\| J1 \|/); assert.match(d, /\[TO CONFIRM estimating and sales lead\]/);
});
