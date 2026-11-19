// BOM roll-up: quantities, scrap, sub-assemblies, conversion cost, missing and stale prices, loops, thresholds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollup, proposalText, DEFAULTS } from '../src/index.js';

const b = (parent, component, qty_per, scrap_pct = null) => ({ parent, component, qty_per, scrap_pct });
const p = (item, price, price_date = '2026-11-01') => ({ item, price, price_date });
const it = (item, std_cost, conversion_cost = null) => ({ item, std_cost, conversion_cost });
const run = (bom, prices, items, s = DEFAULTS) => rollup({ bom, prices, items }, s, '2026-11-18');
const one = (r, item) => r.items.find((i) => i.item === item);

test('quantity per, scrap and conversion cost add up', () => {
  const r = run([b('A', 'X', 2, 10), b('A', 'Y', 1)], [p('X', 5), p('Y', 3)], [it('A', 15, 1)]);
  assert.equal(one(r, 'A').rolled_cost, 15); assert.equal(one(r, 'A').status, 'ok');
});

test('a sub-assembly is costed from its own BOM, and a parent above the threshold is flagged with the per-unit change', () => {
  const r = run([b('TOP', 'SUB', 2), b('SUB', 'X', 3)], [p('X', 2)], [it('TOP', 10), it('SUB', 6)]);
  assert.equal(one(r, 'SUB').rolled_cost, 6); assert.equal(one(r, 'TOP').rolled_cost, 12);
  assert.deepEqual(one(r, 'TOP').findings.map((f) => [f.code, f.amount]), [['cost_up', 2]]);
});

test('the latest price wins, whatever order the prices come in', () => {
  const prices = [p('X', 9, '2026-11-10'), p('X', 5, '2026-01-10')];
  assert.equal(one(run([b('A', 'X', 1)], prices, [it('A', 9)]), 'A').rolled_cost, 9);
  assert.equal(one(run([b('A', 'X', 1)], [...prices].reverse(), [it('A', 9)]), 'A').rolled_cost, 9);
});

test('a component with no price and no BOM makes the roll-up incomplete and is reviewed, not compared', () => {
  const r = run([b('A', 'X', 1), b('A', 'NOPE', 1)], [p('X', 50)], [it('A', 10)]);
  assert.equal(one(r, 'A').complete, false); assert.deepEqual(one(r, 'A').findings.map((f) => f.code), ['missing_price']); assert.deepEqual(r.proposed, []);
});

test('a loop in the structure is flagged instead of recursing for ever', () => {
  const r = run([b('A', 'B', 1), b('B', 'A', 1)], [], [it('A', 1), it('B', 1)]);
  assert.ok(r.items.every((i) => i.findings.some((f) => f.code === 'circular_bom')));
});

test('prices older than the stale limit are listed to watch; the threshold comes from settings', () => {
  const r = run([b('A', 'X', 1)], [p('X', 10, '2024-01-01')], [it('A', 10)]);
  assert.deepEqual(one(r, 'A').findings.map((f) => f.code), ['stale_price']); assert.equal(one(r, 'A').status, 'watch');
  assert.equal(run([b('A', 'X', 1)], [p('X', 11)], [it('A', 10)], { ...DEFAULTS, change_pct: 20 }).flag, 0);
  assert.equal(run([b('A', 'X', 1)], [p('X', 8)], [it('A', 10)]).items[0].findings[0].code, 'cost_down');
});

test('the proposal lists only complete roll-ups that moved, and leaves the recipient to confirm', () => {
  const r = run([b('A', 'X', 1), b('B', 'Y', 1), b('C', 'NOPE', 1)], [p('X', 12), p('Y', 10)], [it('A', 10), it('B', 10), it('C', 1)]);
  const d = proposalText(r, {});
  assert.match(d, /\| A \| 10 \| 12 \| 20 \|/); assert.doesNotMatch(d, /\| B \|/); assert.doesNotMatch(d, /\| C \|/); assert.match(d, /\[TO CONFIRM cost accountant/);
});
