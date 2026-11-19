// Open POs: past due by promise or due date, grace, confirmations, need dates, over-receipts, by supplier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openPurchaseOrders, expediteText, DEFAULTS } from '../src/index.js';

const l = (over = {}) => ({ po_line: 'P1-1', po_number: 'P1', supplier: 'Sup A', item: 'X', order_date: '2026-11-01', due_date: '2026-11-30', promise_date: '2026-11-30', qty_ordered: 100, qty_received: 0, unit_price: 2, need_date: null, ...over });
const run = (rows, s = DEFAULTS) => openPurchaseOrders(rows, s, '2026-11-18');
const codes = (r) => r.items[0].findings.map((f) => f.code);

test('past the promise date with quantity open is past due at the open value', () => {
  const r = run([l({ promise_date: '2026-11-10', qty_received: 40 })]);
  assert.deepEqual(r.items[0].findings.map((f) => [f.code, f.amount]), [['past_due', 120]]); assert.equal(r.items[0].days_late, 8);
});

test('without a promise the due date counts; a fully received line is never late', () => {
  assert.deepEqual(codes(run([l({ promise_date: null, due_date: '2026-11-10' })])), ['past_due', 'no_promise']);
  assert.deepEqual(codes(run([l({ promise_date: '2026-11-10', qty_received: 100 })])), []);
});

test('grace days and the confirmation window come from settings', () => {
  assert.deepEqual(codes(run([l({ promise_date: '2026-11-15' })], { ...DEFAULTS, grace_days: 5 })), []);
  assert.deepEqual(codes(run([l({ promise_date: null })], { ...DEFAULTS, confirm_days: 30 })), []);
});

test('a promise after the production need date is flagged; after the requested date only, watched', () => {
  assert.deepEqual(codes(run([l({ need_date: '2026-11-25' })])), ['promise_after_need']);
  assert.deepEqual(codes(run([l({ promise_date: '2026-12-05' })])), ['promise_after_due']);
});

test('receiving more than ordered is reviewed', () => {
  assert.deepEqual(codes(run([l({ qty_received: 120 })])), ['over_received']);
});

test('suppliers are ranked by past-due value', () => {
  const r = run([l({ promise_date: '2026-11-01' }), l({ po_line: 'P2-1', supplier: 'Sup B', promise_date: '2026-11-01', unit_price: 5 })]);
  assert.deepEqual(r.by_supplier.map((x) => [x.supplier, x.past_due_value]), [['Sup B', 500], ['Sup A', 200]]);
});

test('the status request lists late, unconfirmed and at-risk lines only', () => {
  const r = run([l({ promise_date: '2026-11-01' }), l({ po_line: 'P1-2' })]);
  const d = expediteText(r.items, { supplier: 'Sup A' });
  assert.equal(d.rows.length, 1); assert.match(d.text, /\| P1 \| P1-1 \|/); assert.match(d.text, /\[TO CONFIRM Sup A order desk/);
});
