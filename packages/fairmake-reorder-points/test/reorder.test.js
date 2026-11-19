// Reorder points: availability, safety stock, the reorder point, proposals from usage and lead time.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reorderPoints, ropChangeText, DEFAULTS } from '../src/index.js';

const it = (over = {}) => ({ item: 'A', on_hand: 100, on_order: 0, allocated: 0, safety_stock: 20, reorder_point: 50, lead_time_days: 10, unit_cost: 1, ...over });
const use = (item, usage_date, qty) => ({ item, usage_date, qty });
const run = (items, usage = [], s = DEFAULTS) => reorderPoints({ items, usage }, s, '2026-11-18');
const codes = (r) => r.items[0].findings.map((f) => f.code);

test('available is on hand plus on order less allocated; nothing available is a stockout', () => {
  const r = run([it({ on_hand: 10, allocated: 30, on_order: 5 })]);
  assert.equal(r.items[0].available, -15); assert.deepEqual(codes(r), ['stockout']);
});

test('free stock under safety stock is flagged even with stock on order', () => {
  assert.deepEqual(codes(run([it({ on_hand: 15, on_order: 100, reorder_point: 10 })])), ['below_safety_stock']);
});

test('at or under the reorder point is listed to order', () => {
  assert.deepEqual(codes(run([it({ on_hand: 50 })])), ['at_reorder_point']);
  assert.deepEqual(codes(run([it({ on_hand: 51 })])), []);
});

test('only usage inside the look-back counts, and a reorder point far from it is reviewed with a proposal', () => {
  const r = run([it()], [use('A', '2026-11-01', 450), use('A', '2026-01-01', 9999)]);
  assert.equal(r.items[0].daily_usage, 5); assert.equal(r.items[0].proposed_rop, 70); assert.deepEqual(codes(r), ['rop_stale']);
  assert.deepEqual(r.proposed, [{ item: 'A', reorder_point: 50, proposed_rop: 70, daily_usage: 5, lead_time_days: 10 }]);
});

test('without a usage file no reorder point is judged; an item with none is reviewed', () => {
  assert.deepEqual(codes(run([it()])), []);
  assert.deepEqual(codes(run([it({ reorder_point: null })])), ['no_rop']);
});

test('the look-back and threshold come from settings', () => {
  assert.deepEqual(codes(run([it()], [use('A', '2026-11-01', 450)], { ...DEFAULTS, review_pct: 50 })), []);
  assert.equal(run([it()], [use('A', '2026-11-01', 450)], { ...DEFAULTS, lookback_days: 30 }).items[0].daily_usage, 15);
});

test('the proposal lists stale reorder points only', () => {
  const r = run([it(), it({ item: 'B' })], [use('A', '2026-11-01', 450), use('B', '2026-11-01', 270)]);
  const d = ropChangeText(r, {}); assert.match(d, /\| A \| 50 \| 70 \|/); assert.doesNotMatch(d, /\| B \|/); assert.match(d, /\[TO CONFIRM purchasing or planning lead\]/);
});
