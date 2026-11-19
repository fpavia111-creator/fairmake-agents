// Supplier scorecards: on-time with grace, ppm, price against PO, weights, ranking, thin data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorecards, scorecardText, DEFAULTS } from '../src/index.js';

const r = (receipt, supplier, over = {}) => ({ receipt, supplier, item: 'X', due_date: '2026-11-01', receipt_date: '2026-11-01', qty_received: 100, qty_rejected: 0, unit_price: 10, po_price: 10, ...over });
const three = (supplier, over = {}) => [r(`${supplier}1`, supplier, over), r(`${supplier}2`, supplier), r(`${supplier}3`, supplier)];
const run = (rows, s = DEFAULTS) => scorecards(rows, s);
const card = (res, name) => res.items.find((i) => i.supplier === name);

test('on time is by the due date plus grace', () => {
  const late = run(three('A', { receipt_date: '2026-11-03' }));
  assert.equal(card(late, 'A').on_time_pct, 66.7); assert.deepEqual(card(late, 'A').findings.map((f) => f.code), ['low_on_time']);
  assert.equal(card(run(three('A', { receipt_date: '2026-11-03' }), { ...DEFAULTS, grace_days: 2 }), 'A').on_time_pct, 100);
});

test('rejects are measured in parts per million against the target', () => {
  const res = run(three('A', { qty_rejected: 2 }));
  assert.equal(card(res, 'A').ppm, 6667); assert.deepEqual(card(res, 'A').findings.map((f) => f.code), ['high_ppm']);
});

test('price above PO is the extra paid, as a share of PO value', () => {
  const res = run(three('A', { unit_price: 12 }));
  assert.equal(card(res, 'A').price_variance_pct, 6.67); assert.deepEqual(card(res, 'A').findings.map((f) => [f.code, f.amount]), [['price_over_po', 200]]);
});

test('the weighted score ranks suppliers best first', () => {
  const res = run([...three('Good'), ...three('Late', { receipt_date: '2026-11-05' })]);
  assert.deepEqual(res.items.map((i) => [i.supplier, i.rank]), [['Good', 1], ['Late', 2]]); assert.equal(card(res, 'Good').score, 100);
});

test('weights come from settings', () => {
  const res = run(three('A', { qty_rejected: 2 }), { ...DEFAULTS, weights: { on_time: 0, quality: 100, price: 0 } });
  assert.equal(card(res, 'A').score, 86.67);
});

test('fewer receipts than the minimum are reviewed', () => {
  assert.deepEqual(card(run([r('1', 'A')]), 'A').findings.map((f) => f.code), ['few_receipts']);
});

test('the scorecard draft carries the measures and the points to work on', () => {
  const res = run(three('A', { qty_rejected: 2 }));
  const d = scorecardText(card(res, 'A'), { period: 'November' });
  assert.match(d, /\| Rejects \| 6667 ppm \|/); assert.match(d, /Points to work on/); assert.match(d, /\[TO CONFIRM A account or quality contact\]/);
});
