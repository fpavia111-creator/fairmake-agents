// Traceability: each kind of break, sub-assembly lots, resold received lots, serials, the gap list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traceability, traceGapsText } from '../src/index.js';

const c = (record, finished_lot, component, component_lot, consume_date = '2026-11-02', work_order = 'WO-1') => ({ record, work_order, finished_lot, component, component_lot, qty: 1, consume_date });
const rc = (lot, receipt_date = '2026-10-01') => ({ lot, item: 'X', receipt_date, supplier: 'S' });
const sh = (shipment, lot_or_serial, qty = 5) => ({ shipment, customer: 'Cust', item: 'P', lot_or_serial, ship_date: '2026-11-10', qty });
const run = (consumption, receipts = [], shipments = []) => traceability({ consumption, receipts, shipments });
const by = (r) => Object.fromEntries(r.items.map((i) => [i.reference, i.findings.map((f) => f.code)]));

test('a finished lot made from received lots and shipped is clean, and counts its shipments', () => {
  const r = run([c('1', 'FG', 'A', 'L1')], [rc('L1')], [sh('S1', 'FG')]);
  assert.deepEqual(by(r), { FG: [] }); assert.equal(r.items[0].shipments, 1);
});

test('an issue with no component lot, or to no finished lot, is a break', () => {
  assert.deepEqual(by(run([c('1', 'FG', 'A', '')])), { FG: ['consumed_without_lot'] });
  assert.deepEqual(Object.values(by(run([c('1', '', 'A', 'L1')], [rc('L1')]))), [['consumed_without_lot']]);
});

test('a component lot never received is reviewed; one issued before its receipt date is flagged', () => {
  assert.deepEqual(by(run([c('1', 'FG', 'A', 'L9')])), { FG: ['lot_not_received'] });
  assert.deepEqual(by(run([c('1', 'FG', 'A', 'L1', '2026-09-01')], [rc('L1', '2026-10-01')])), { FG: ['used_before_received'] });
});

test('a finished lot used as a component counts as produced', () => {
  assert.deepEqual(by(run([c('1', 'SUB', 'A', 'L1'), c('2', 'TOP', 'SUB', 'SUB')], [rc('L1')])), { SUB: [], TOP: [] });
});

test('shipments with no lot, or a lot never produced or received, are breaks; a received lot resold is fine', () => {
  const r = run([], [rc('L1')], [sh('S1', ''), sh('S2', 'ZZ'), sh('S3', 'L1')]);
  assert.deepEqual(by(r), { 'S1 (no lot)': ['shipped_no_lot'], ZZ: ['shipped_unknown_lot'] });
});

test('one serial on two single-unit shipments is shipped twice; a lot shipped in parts is not', () => {
  assert.deepEqual(by(run([c('1', 'SN1', 'A', 'L1')], [rc('L1')], [sh('S1', 'SN1', 1), sh('S2', 'SN1', 1)])).SN1, ['serial_shipped_twice']);
  assert.deepEqual(by(run([c('1', 'FG', 'A', 'L1')], [rc('L1')], [sh('S1', 'FG', 5), sh('S2', 'FG', 5)])).FG, []);
});

test('the gap list names every break and changes nothing', () => {
  const d = traceGapsText(run([c('1', 'FG', 'A', '')]), {});
  assert.match(d, /\| FG \| finished_lot \|/); assert.match(d, /this note changes no record and tells no customer/);
});
