// Order backlog: past due by promise or request, due soon, promises, holds, closed lines, roll-ups.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderBacklog, promiseUpdateText, DEFAULTS } from '../src/index.js';

const l = (over = {}) => ({ order_line: 'L1', order_number: 'SO1', customer: 'Cust', item: 'X', order_date: '2026-11-01', requested_date: '2026-12-10', promise_date: '2026-12-10', qty_open: 10, unit_price: 5, line_status: 'Open', ...over });
const run = (rows, s = DEFAULTS) => orderBacklog(rows, s, '2026-11-18');
const codes = (r) => r.items[0].findings.map((f) => f.code);

test('past the promise date is past due at the open value', () => {
  const r = run([l({ promise_date: '2026-11-10', requested_date: '2026-11-10' })]);
  assert.deepEqual(r.items[0].findings.map((f) => [f.code, f.amount]), [['past_due', 50]]); assert.equal(r.past_due_value, 50);
});

test('with no promise the requested date counts, and the line is reviewed', () => {
  assert.deepEqual(codes(run([l({ promise_date: null, requested_date: '2026-11-10' })])), ['past_due', 'no_promise']);
});

test('due within the look-ahead is listed; a promise after the request is watched', () => {
  assert.deepEqual(codes(run([l({ promise_date: '2026-11-20', requested_date: '2026-11-20' })])), ['due_soon']);
  assert.deepEqual(codes(run([l({ promise_date: '2026-12-20' })])), ['promised_after_request']);
  assert.deepEqual(codes(run([l({ promise_date: '2026-11-20', requested_date: '2026-11-20' })], { at_risk_days: 1 })), []);
});

test('holds are reviewed; closed, cancelled and fully shipped lines are left out', () => {
  assert.deepEqual(codes(run([l({ line_status: 'Credit Hold' })])), ['on_hold']);
  assert.equal(run([l({ line_status: 'Cancelled' }), l({ order_line: 'L2', qty_open: 0 })]).open_lines, 0);
});

test('backlog rolls up by promise month and by customer, most past due first', () => {
  const r = run([l(), l({ order_line: 'L2', customer: 'Other', promise_date: '2026-11-01', requested_date: '2026-11-01' })]);
  assert.deepEqual(r.by_month.map((m) => [m.month, m.open_value]), [['2026-11', 50], ['2026-12', 50]]);
  assert.equal(r.by_customer[0].customer, 'Other');
});

test('rows of the same line are counted once', () => {
  assert.equal(run([l(), l()]).open_lines, 1);
});

test('the status update lists late and late-promised lines and asks for dates to be checked', () => {
  const r = run([l({ promise_date: '2026-11-10', requested_date: '2026-11-10' }), l({ order_line: 'L2', order_number: 'SO2' })]);
  const d = promiseUpdateText(r.items, { customer: 'Cust' });
  assert.equal(d.rows.length, 1); assert.match(d.text, /\| SO1 \|.*\| late \|/); assert.match(d.text, /\[CHECK with production before sending\]/);
});
