// WIP aging: buckets, stale and closed WIP, negative WIP, past due, over-completed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wipAging, wipReviewText, DEFAULTS } from '../src/index.js';

const wo = (over = {}) => ({ work_order: 'W1', item: 'A', wo_status: 'Released', release_date: '2026-11-01', due_date: '2026-12-31', last_activity: '2026-11-28', wip_value: 100, qty_ordered: 10, qty_completed: 0, ...over });
const run = (rows, s = DEFAULTS) => wipAging(rows, s, '2026-11-30');
const codes = (r) => r.items[0].findings.map((f) => f.code);

test('work orders fall into age buckets by days since release, and closed ones are kept out of them', () => {
  const r = run([wo(), wo({ work_order: 'W2', release_date: '2026-09-20' }), wo({ work_order: 'W3', release_date: '2026-05-01' }), wo({ work_order: 'W4', wo_status: 'Closed', wip_value: 0 })]);
  assert.deepEqual(r.by_age.map((b) => [b.age_bucket, b.count]), [['0-30', 1], ['61-90', 1], ['90+', 1]]);
  assert.equal(r.open, 3);
});

test('WIP with no activity past the stale limit is flagged at its value; the last activity of any row counts', () => {
  assert.deepEqual(codes(run([wo({ last_activity: '2026-10-01' })])), ['stale']);
  assert.deepEqual(codes(run([wo({ last_activity: '2026-10-01' }), wo({ last_activity: '2026-11-25', wip_value: 0 })])), []);
  assert.deepEqual(codes(run([wo({ last_activity: '2026-10-01' })], { ...DEFAULTS, stale_days: 90 })), []);
});

test('a closed order holding WIP is flagged; a closed order at zero is fine', () => {
  const r = run([wo({ wo_status: 'Complete', wip_value: 450 })]);
  assert.deepEqual(r.items[0].findings.map((f) => [f.code, f.amount]), [['closed_with_wip', 450]]);
  assert.equal(run([wo({ wo_status: 'Closed', wip_value: 0 })]).items[0].status, 'ok');
});

test('negative WIP is flagged and over-completion is reviewed', () => {
  assert.deepEqual(codes(run([wo({ wip_value: -20 })])), ['negative_wip']);
  assert.deepEqual(codes(run([wo({ qty_completed: 12 })])), ['over_completed']);
});

test('past due is listed to watch only while the order is open', () => {
  assert.deepEqual(codes(run([wo({ due_date: '2026-11-15' })])), ['past_due']);
  assert.deepEqual(codes(run([wo({ due_date: '2026-11-15', wo_status: 'Closed', wip_value: 0 })])), []);
});

test('custom bucket edges from settings', () => {
  const r = run([wo({ release_date: '2026-09-20' })], { ...DEFAULTS, buckets: [60, 120] });
  assert.equal(r.items[0].age_bucket, '61-120');
});

test('the review draft lists orders to act on or review and the WIP at stake', () => {
  const r = run([wo({ last_activity: '2026-09-01' }), wo({ work_order: 'W2' })]);
  const d = wipReviewText(r, {});
  assert.match(d, /\| W1 \|/); assert.doesNotMatch(d, /\| W2 \|/); assert.match(d, /100 of WIP sits on stale work orders/); assert.match(d, /\[TO CONFIRM production control lead\]/);
});
