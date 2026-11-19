// Invoices against customer POs: prices, cumulative quantities, items, POs, duplicates, 810 totals, the X12 path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { invoiceCheck, rowsFromX12, correctionText, DEFAULTS } from '../src/index.js';

const o = (po_number, item, qty, unit_price) => ({ po_number, line: '1', item, qty, unit_price });
const inv = (invoice, po_number, item, qty, unit_price, invoice_date = '2026-11-05') => ({ invoice, po_number, line: '1', item, qty, unit_price, invoice_date });
const run = (orders, invoices, totals = [], s = DEFAULTS) => invoiceCheck({ orders, invoices, totals }, s);
const by = (r) => Object.fromEntries(r.items.map((i) => [i.invoice, i.findings.map((f) => f.code)]));

test('an invoice at the PO price and quantity matches', () => {
  assert.deepEqual(by(run([o('P1', 'A', 10, 5)], [inv('I1', 'P1', 'A', 10, 5)])), { I1: [] });
});

test('a price off the PO is flagged at the difference times quantity; inside the tolerance it is not', () => {
  const r = run([o('P1', 'A', 10, 5)], [inv('I1', 'P1', 'A', 10, 5.5)]);
  assert.deepEqual(r.items[0].findings.map((f) => [f.code, f.amount]), [['price_mismatch', 5]]);
  assert.deepEqual(by(run([o('P1', 'A', 10, 5)], [inv('I1', 'P1', 'A', 10, 5.005)])), { I1: [] });
});

test('quantities add up across invoices in date order', () => {
  const r = run([o('P1', 'A', 10, 5)], [inv('I2', 'P1', 'A', 7, 5, '2026-11-08'), inv('I1', 'P1', 'A', 6, 5, '2026-11-01')]);
  assert.deepEqual(by(r), { I1: [], I2: ['qty_over_po'] });
});

test('items not on the PO and POs not found are flagged', () => {
  assert.deepEqual(by(run([o('P1', 'A', 10, 5)], [inv('I1', 'P1', 'B', 1, 5), inv('I2', 'P9', 'A', 1, 5)])), { I1: ['item_not_on_po'], I2: ['po_not_found'] });
});

test('an invoice with the same lines as an earlier one is reviewed as a possible duplicate', () => {
  const r = run([o('P1', 'A', 100, 5)], [inv('I1', 'P1', 'A', 10, 5, '2026-11-01'), inv('I2', 'P1', 'A', 10, 5, '2026-11-02')]);
  assert.deepEqual(by(r), { I1: [], I2: ['possible_duplicate'] });
});

test('an 810 total that does not equal its lines is reviewed; the X12 file reads into rows', () => {
  assert.deepEqual(by(run([o('P1', 'A', 10, 5)], [inv('I1', 'P1', 'A', 10, 5)], [{ invoice: 'I1', total: 60 }])), { I1: ['total_mismatch'] });
  const x = rowsFromX12(readFileSync(new URL('../fixtures/orders-and-invoices.edi', import.meta.url), 'utf8'));
  assert.equal(x.orders.length, 3); assert.equal(x.invoices.length, 2); assert.deepEqual(x.totals, [{ invoice: 'INV-3001', total: 183 }]);
});

test('the correction list says nothing was sent or credited', () => {
  const d = correctionText(run([o('P1', 'A', 10, 5)], [inv('I1', 'P1', 'A', 10, 6)]), {});
  assert.match(d, /\| I1 \| P1 \| 60 \| 10 \|/); assert.match(d, /Nothing has been sent or credited/);
});
