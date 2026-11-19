// Deductions: reason map, evidence checks, dispute windows, small amounts, missing references, the dispute draft.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deductions, disputeText, DEFAULTS } from '../src/index.js';

const d = (over = {}) => ({ deduction: 'D1', customer: 'Mart', deduction_date: '2026-11-10', amount: 200, reason_code: 'ASN', reference: 'I1', description: '', ...over });
const sh = (over = {}) => ({ invoice: 'I1', po_number: 'P1', ship_date: '2026-11-01T08:00:00', asn_sent: '2026-11-01T09:00:00', pod: 'Y', qty_shipped: 10, qty_invoiced: 10, ...over });
const run = (rows, shipments = [], s = DEFAULTS) => deductions({ rows, shipments }, s, '2026-11-18');
const codes = (r) => r.items[0].findings.map((f) => f.code);

test('a late-ASN fine is disputable when the ASN went within the grace after shipping; otherwise it needs evidence', () => {
  assert.deepEqual(codes(run([d()], [sh()])), ['disputable']);
  assert.deepEqual(codes(run([d()], [sh({ asn_sent: '2026-11-03T09:00:00' })])), ['needs_evidence']);
});

test('a shortage is disputable with a clean POD and full quantity shipped', () => {
  assert.deepEqual(codes(run([d({ reason_code: 'SHT' })], [sh()])), ['disputable']);
  assert.deepEqual(codes(run([d({ reason_code: 'SHT' })], [sh({ pod: 'N' })])), ['needs_evidence']);
  assert.deepEqual(codes(run([d({ reason_code: 'SHT' })], [sh({ qty_shipped: 8 })])), ['needs_evidence']);
});

test('the dispute-by date follows the customer window; past it a disputable deduction is lost, not flagged', () => {
  const s = { ...DEFAULTS, dispute_window_days: { Mart: 5 } };
  const r = run([d()], [sh()], s);
  assert.equal(r.items[0].dispute_by, '2026-11-15'); assert.equal(r.items[0].status, 'watch'); assert.equal(r.disputable_lost, 200); assert.equal(r.disputable_open, 0);
});

test('unknown reason codes, missing invoices and invoices not in the shipment file are reviewed', () => {
  assert.deepEqual(codes(run([d({ reason_code: 'Q7', reference: '' })])), ['unknown_reason', 'no_reference']);
  assert.deepEqual(codes(run([d({ reference: 'I9' })], [sh()])), ['no_reference', 'needs_evidence']);
});

test('small deductions are listed as write-off candidates, never written off', () => {
  assert.deepEqual(codes(run([d({ amount: 20, reason_code: 'PRC' })], [sh()])), ['needs_evidence', 'small_amount']);
});

test('amounts given as negative numbers on a remittance are counted as positive deductions', () => {
  assert.equal(run([d({ amount: -150 })], [sh()]).amount, 150);
});

test('the dispute draft lists open disputable deductions and asks for the documents', () => {
  const r = run([d(), d({ deduction: 'D2', reason_code: 'PRC' })], [sh()]);
  const x = disputeText(r.items, { customer: 'Mart' });
  assert.equal(x.total, 200); assert.match(x.text, /\| D1 \| I1 \|/); assert.doesNotMatch(x.text, /\| D2 \|/); assert.match(x.text, /\[ATTACH proof of delivery and ASN records\]/);
});
