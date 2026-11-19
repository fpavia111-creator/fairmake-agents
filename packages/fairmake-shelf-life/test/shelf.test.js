// Shelf life: expired and expiring stock, missing dates, shipments expired, short-dated or out of FEFO order, the calendar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRuntime } from 'fairmake-core';
import { manifest, shelfLife, dispositionText, DEFAULTS } from '../src/index.js';

const lot = (lotNo, expiry_date, over = {}) => ({ lot: lotNo, item: 'X', location: 'W', on_hand: 10, mfg_date: '2026-01-01', expiry_date, unit_cost: 2, ...over });
const sh = (shipment, lotNo, ship_date, customer = 'Cust') => ({ shipment, customer, item: 'X', lot: lotNo, ship_date, qty: 1 });
const run = (lots, shipments = [], s = DEFAULTS) => shelfLife({ lots, shipments }, s, '2026-11-18');
const by = (r) => Object.fromEntries(r.items.map((i) => [i.lot, i.findings.map((f) => f.code)]));

test('expired stock on hand is flagged at its value; inside the warning window is expiring soon', () => {
  const r = run([lot('A', '2026-11-01'), lot('B', '2026-12-01'), lot('C', '2027-06-01')]);
  assert.deepEqual(by(r), { A: ['expired_on_hand'], B: ['expiring_soon'], C: [] }); assert.equal(r.expired_value, 20);
});

test('a lot with stock and no expiry is reviewed; an empty lot is not chased', () => {
  assert.deepEqual(by(run([lot('A', null), lot('B', '2026-01-01', { on_hand: 0 })])), { A: ['no_expiry'], B: [] });
});

test('a shipment after expiry is flagged; one with less life than the customer needs is short-dated', () => {
  const s = { ...DEFAULTS, customer_min_days: { 'Big Box': 90 } };
  const r = run([lot('A', '2026-11-01', { on_hand: 0 }), lot('B', '2027-01-20')], [sh('S1', 'A', '2026-11-03'), sh('S2', 'B', '2026-11-10', 'Big Box')], s);
  assert.deepEqual(by(r), { A: ['shipped_expired'], B: ['short_dated_shipment'] });
});

test('taking a newer lot while an older, still good one is in stock is a FEFO miss; an already expired older lot is not', () => {
  const r = run([lot('OLD', '2027-01-01'), lot('NEW', '2027-06-01'), lot('DEAD', '2026-11-05')], [sh('S1', 'NEW', '2026-11-10')]);
  assert.deepEqual(by(r).NEW, ['fefo_skipped']); assert.match(r.items.find((i) => i.lot === 'NEW').findings[0].detail, /OLD \(expires 2027-01-01\)/);
});

test('the warning window and default minimum come from settings', () => {
  assert.deepEqual(by(run([lot('B', '2026-12-01')], [], { ...DEFAULTS, warn_days: 7 })), { B: [] });
  assert.deepEqual(by(run([lot('B', '2027-01-20')], [sh('S', 'B', '2026-11-10')], { ...DEFAULTS, default_min_days: 90 })).B, ['short_dated_shipment']);
});

test('the report writes an expiry calendar for lots still in stock', async () => {
  const root = mkdtempSync(join(tmpdir(), 'shelf-')); cpSync(fileURLToPath(new URL('../fixtures', import.meta.url)), root, { recursive: true });
  const r = await new AgentRuntime(manifest, { root, audit: false }).call('shelf_life_write_report', { lots: 'lots.csv', shipments: 'shipments.csv', as_of: '2026-11-18' });
  assert.equal(r.status, 'executed', r.reason); const ics = readFileSync(join(root, r.result.files[2]), 'utf8');
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 5); assert.doesNotMatch(ics, /L-2601/);
});

test('the disposition list covers lots to act on or review, and tells no customer', () => {
  const d = dispositionText(run([lot('A', '2026-11-01'), lot('C', '2027-06-01')]), {});
  assert.match(d, /\| A \|/); assert.doesNotMatch(d, /\| C \|/); assert.match(d, /Customers are not told/);
});
