// Obsolete inventory: buckets by idle months and months of supply, reserve percentages and minimum, inactive items, missing data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obsoleteInventory, reserveText, DEFAULTS } from '../src/index.js';

const it = (over = {}) => ({ item: 'I1', description: 'Thing', on_hand: 100, unit_cost: 10, last_used: '2026-11-01', last_sold: null, usage_12m: 600, item_status: 'Active', ...over });
const run = (rows, s = DEFAULTS) => obsoleteInventory(rows, s, '2026-11-30');
const one = (r) => r.items[0];

test('idle past the obsolete limit is obsolete at the full reserve; past the slow limit is slow at its percentage', () => {
  const o = one(run([it({ last_used: '2025-06-01' })])); assert.equal(o.bucket, 'obsolete'); assert.equal(o.reserve, 1000);
  const s = one(run([it({ last_used: '2026-04-01' })])); assert.equal(s.bucket, 'slow'); assert.equal(s.reserve, 250); assert.equal(s.status, 'review');
});

test('the latest of last used and last sold counts', () => {
  assert.equal(one(run([it({ last_used: '2025-01-01', last_sold: '2026-11-15' })])).bucket, 'active');
});

test('stock above the excess months of supply is excess, reserved only on the part above the limit', () => {
  const r = one(run([it({ on_hand: 1000, usage_12m: 240 })]));
  assert.equal(r.months_of_supply, 50); assert.equal(r.bucket, 'excess'); assert.equal(r.reserve, 2600);
});

test('lines under the minimum value get no reserve; never moved with zero usage is obsolete', () => {
  assert.equal(one(run([it({ on_hand: 2, last_used: '2024-01-01' })])).reserve, 0);
  assert.equal(one(run([it({ last_used: null, usage_12m: 0 })])).bucket, 'obsolete');
});

test('no dates and no usage is reviewed as missing movement data; an inactive item with stock is flagged', () => {
  assert.deepEqual(one(run([it({ last_used: null, usage_12m: null })])).findings.map((f) => f.code), ['no_movement_data']);
  assert.deepEqual(one(run([it({ item_status: 'Obsolete' })])).findings.map((f) => f.code), ['inactive_with_stock']);
});

test('reserve percentages come from settings and merge with the defaults', () => {
  const s = { ...DEFAULTS, reserve_pct: { ...DEFAULTS.reserve_pct, slow: 50 } };
  assert.equal(one(run([it({ last_used: '2026-04-01' })], s)).reserve, 500);
});

test('rows with neither quantity nor cost are skipped, and the proposal lists only reserved lines', () => {
  const r = run([it({ item: 'Inventory', on_hand: null, unit_cost: null }), it({ item: 'A', last_used: '2025-01-01' }), it({ item: 'B' })]);
  assert.equal(r.items_checked, 2);
  const d = reserveText(r, {}); assert.match(d, /\| A \|/); assert.doesNotMatch(d, /\| B \|/); assert.match(d, /\[TO CONFIRM controller\]/);
});
