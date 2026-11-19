// ASN checks: each error kind, timing, fines from settings, the X12 path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { asnErrors, rowsFromX12, correctionText, DEFAULTS } from '../src/index.js';

const o = (po_number, item, qty) => ({ po_number, line: '1', item, qty, requested_ship: null });
const a = (asn, po_number, item, qty, sscc = 'S1', sent_at = '2026-11-05T08:30:00') => ({ asn, po_number, item, qty, sscc, ship_date: '2026-11-05', sent_at });
const sh = (po_number, item, qty, ship_date = '2026-11-05T08:00:00') => ({ po_number, item, qty, ship_date });
const run = (orders, asns, shipments, s = DEFAULTS) => asnErrors({ orders, asns, shipments }, s);
const by = (r) => Object.fromEntries(r.items.map((i) => [i.po_number, i.findings.map((f) => f.code)]));

test('a matching ASN sent in time is clean', () => {
  assert.deepEqual(by(run([o('P1', 'A', 10)], [a('N1', 'P1', 'A', 10)], [sh('P1', 'A', 10)])), { P1: [] });
});

test('a shipment with no ASN, and an ASN sent past the grace, are flagged', () => {
  assert.deepEqual(by(run([o('P1', 'A', 10)], [], [sh('P1', 'A', 10)])), { P1: ['no_asn'] });
  assert.deepEqual(by(run([o('P1', 'A', 10)], [a('N1', 'P1', 'A', 10, 'S1', '2026-11-05T12:00:00')], [sh('P1', 'A', 10)])), { P1: ['asn_late'] });
});

test('quantities against the PO and the shipment, and items not ordered', () => {
  assert.deepEqual(by(run([o('P1', 'A', 10)], [a('N1', 'P1', 'A', 12)], [sh('P1', 'A', 12)])), { P1: ['asn_over_po'] });
  assert.deepEqual(by(run([o('P1', 'A', 10)], [a('N1', 'P1', 'A', 8)], [sh('P1', 'A', 10)])), { P1: ['asn_qty_mismatch'] });
  assert.deepEqual(by(run([o('P1', 'A', 10)], [a('N1', 'P1', 'B', 10)], [])), { P1: ['asn_item_not_on_po'] });
});

test('SSCC labels must be present and not reused across ASNs; ASNs for unknown POs are reviewed', () => {
  const r = run([o('P1', 'A', 1), o('P2', 'A', 1)], [a('N1', 'P1', 'A', 1, 'X'), a('N2', 'P2', 'A', 1, 'X'), a('N3', 'P3', 'A', 1, '')], []);
  assert.deepEqual(by(r), { P1: ['duplicate_sscc'], P2: ['duplicate_sscc'], P3: ['po_not_found', 'missing_sscc'] });
});

test('fines come from settings and add up per PO', () => {
  const r = run([o('P1', 'A', 10)], [], [sh('P1', 'A', 10)], { ...DEFAULTS, fines: { no_asn: 300 } });
  assert.equal(r.fines_at_risk, 300); assert.equal(r.items[0].findings[0].amount, 300);
});

test('an X12 file becomes order and ASN rows with SSCC and send time', () => {
  const x = rowsFromX12(readFileSync(new URL('../fixtures/orders-and-asns.edi', import.meta.url), 'utf8'));
  assert.equal(x.orders.length, 3); assert.equal(x.asns.length, 2); assert.equal(x.asns[1].qty, 10); assert.equal(x.asns[0].sscc, '00012345600000000011'); assert.equal(x.asns[0].sent_at, '2026-11-05T09:00:00');
});

test('the correction note lists every PO with errors and transmits nothing', () => {
  const d = correctionText(run([o('P1', 'A', 10)], [], [sh('P1', 'A', 10)]), {});
  assert.match(d, /\| P1 \| 10 \| 0 \| 10 \|/); assert.match(d, /Nothing has been transmitted/);
});
