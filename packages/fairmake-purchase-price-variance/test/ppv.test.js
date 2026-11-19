// Purchase price variance: tolerances, favorable lines, unit slips, price jumps, standards to review, the price query.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceVariance, priceQueryText, DEFAULTS } from '../src/index.js';

const line = (over = {}) => ({ receipt: 'R1', po_number: 'P1', item: 'A', supplier: 'Acme Metals', receipt_date: '2026-11-01', qty: 100, unit_price: 10, std_cost: 10, ...over });
const run = (rows, s = DEFAULTS) => priceVariance(rows, s);
const codes = (r, i = 0) => r.items[i].findings.map((f) => f.code);

test('a line is flagged only when price and amount are both over tolerance', () => {
  assert.deepEqual(codes(run([line({ unit_price: 12 })])), ['ppv_unfavorable']);
  assert.equal(run([line({ unit_price: 12 })]).items[0].ppv, 200);
  assert.deepEqual(codes(run([line({ unit_price: 10.4 })])), [], '4% is inside the 5% tolerance');
  assert.deepEqual(codes(run([line({ qty: 5, unit_price: 12 })])), [], '10 is under the 100 amount tolerance');
});

test('a price far under standard is listed to watch, not flagged', () => {
  const r = run([line({ unit_price: 8 })]);
  assert.deepEqual(codes(r), ['ppv_favorable']); assert.equal(r.items[0].status, 'watch'); assert.equal(r.flag, 0);
});

test('a price many times the standard is a unit-of-measure slip and is not counted as variance', () => {
  const r = run([line({ unit_price: 120, std_cost: 10 }), line({ receipt: 'R2', unit_price: 1, std_cost: 10 })]);
  assert.deepEqual(r.items.map((i) => i.findings.map((f) => f.code)), [['uom_suspect'], ['uom_suspect']]);
  assert.equal(r.ppv_total, 0);
});

test('no standard and no price are reviewed', () => {
  const r = run([line({ std_cost: null }), line({ receipt: 'R2', unit_price: null })]);
  assert.deepEqual(r.items.map((i) => [i.status, i.findings[0].code]), [['review', 'no_standard'], ['review', 'no_price']]);
});

test('a price jump is measured against the same supplier\'s previous receipt by date, in any row order', () => {
  const rows = [line({ receipt: 'R2', receipt_date: '2026-11-10', unit_price: 11.5 }), line({ receipt: 'R1', receipt_date: '2026-11-01', unit_price: 10 }), line({ receipt: 'R3', supplier: 'Other Co', receipt_date: '2026-11-12', unit_price: 13 })];
  const r = run(rows);
  const by = Object.fromEntries(r.items.map((i) => [i.receipt, i.findings.map((f) => f.code)]));
  assert.deepEqual(by.R2, ['ppv_unfavorable', 'price_jump']); assert.deepEqual(by.R3, ['ppv_unfavorable'], 'another supplier is not a jump');
  assert.deepEqual(run([...rows].reverse()).items.map((i) => i.findings.map((f) => f.code)), r.items.map((i) => i.findings.map((f) => f.code)));
});

test('a standard every receipt disagrees with is named, with the weighted average price', () => {
  const r = run([line({ unit_price: 12, qty: 100 }), line({ receipt: 'R2', receipt_date: '2026-11-05', unit_price: 13, qty: 300 })]);
  assert.deepEqual(r.standards_to_review, [{ item: 'A', receipts: 2, std_cost: 10, avg_price: 12.75, change_pct: 27.5 }]);
  assert.deepEqual(run([line({ unit_price: 12 }), line({ receipt: 'R2', unit_price: 10 })]).standards_to_review, []);
});

test('the price query lists the over-standard and jumped lines only, with the contact left to confirm', () => {
  const r = run([line({ unit_price: 12 }), line({ receipt: 'R2', receipt_date: '2026-11-03', unit_price: 10.1 })]);
  const d = priceQueryText(r.items, { supplier: 'Acme Metals' });
  assert.equal(d.rows.length, 1); assert.match(d.text, /\[TO CONFIRM Acme Metals sales or account contact\]/); assert.match(d.text, /\| R1 \|/); assert.doesNotMatch(d.text, /\| R2 \|/);
});
