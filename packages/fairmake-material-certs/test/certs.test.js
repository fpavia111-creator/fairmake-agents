// Material certificates: required or not, lot match, min and max, missing properties, certificates not on file, no spec.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { materialCerts, certRequestText } from '../src/index.js';

const specs = { items: { BAR: { cert_required: true, properties: { tensile: { min: 95 }, hardness: { max: 32 } } }, NUT: { cert_required: false } } };
const rc = (receipt, item = 'BAR', cert_id = 'M1', lot = 'H1') => ({ receipt, item, lot, supplier: 'Mill Co', receipt_date: '2026-11-01', cert_id });
const ct = (cert_id, property, value, lot = 'H1') => ({ cert_id, lot, property, value });
const good = [ct('M1', 'tensile', 100), ct('M1', 'hardness', 30)];
const run = (receipts, certs = good, sp = specs) => materialCerts({ receipts, certs, specs: sp });
const by = (r) => Object.fromEntries(r.items.map((i) => [i.receipt, i.findings.map((f) => f.code)]));

test('a certificate in spec for the right lot is fine', () => {
  assert.deepEqual(by(run([rc('R1')])), { R1: [] });
});

test('a required certificate that is missing is flagged; one not required is not', () => {
  assert.deepEqual(by(run([rc('R1', 'BAR', ''), rc('R2', 'NUT', '')])), { R1: ['cert_missing'], R2: [] });
});

test('values outside min or max are out of spec; property names ignore letter case', () => {
  assert.deepEqual(by(run([rc('R1')], [ct('M1', 'Tensile', 90), ct('M1', 'HARDNESS', 30)])), { R1: ['out_of_spec'] });
  assert.deepEqual(by(run([rc('R1')], [ct('M1', 'tensile', 100), ct('M1', 'hardness', 35)])), { R1: ['out_of_spec'] });
});

test('a certificate for another lot is flagged; a property it does not report is reviewed', () => {
  assert.deepEqual(by(run([rc('R1', 'BAR', 'M1', 'H2')])), { R1: ['cert_lot_mismatch'] });
  assert.deepEqual(by(run([rc('R1')], [ct('M1', 'tensile', 100)])), { R1: ['property_missing'] });
});

test('a certificate id not in the certificates file is reviewed; without a certificates file it is not checked', () => {
  assert.deepEqual(by(run([rc('R1', 'BAR', 'M9')])), { R1: ['cert_not_found'] });
  assert.deepEqual(by(run([rc('R1', 'BAR', 'M9')], [])), { R1: [] });
});

test('items with no spec are watched', () => {
  assert.deepEqual(by(run([rc('R1', 'OTHER')])), { R1: ['no_spec'] });
});

test('the request lists the supplier\'s problem receipts only', () => {
  const r = run([rc('R1'), rc('R2', 'BAR', '')]);
  const d = certRequestText(r.items, { supplier: 'Mill Co' });
  assert.equal(d.rows.length, 1); assert.match(d.text, /\| R2 \| BAR \| H1 \| none \|/); assert.match(d.text, /\[TO CONFIRM Mill Co quality contact\]/);
});
