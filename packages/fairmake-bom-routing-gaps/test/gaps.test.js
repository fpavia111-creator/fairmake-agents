// BOM and routing completeness: what a made item needs, component problems, routing steps, loops, settings words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bomGaps, fixListText, DEFAULTS } from '../src/index.js';

const it = (item, item_type = 'Make', item_status = 'Active') => ({ item, item_type, item_status });
const b = (parent, component, qty_per = 1) => ({ parent, component, qty_per });
const rt = (item, operation = '10', work_center = 'WC', setup_hours = 0.1, run_hours = 0.1) => ({ item, operation, work_center, setup_hours, run_hours });
const run = (items, bom, routings, s = DEFAULTS) => bomGaps({ items, bom, routings }, s);
const by = (r) => Object.fromEntries(r.items.map((i) => [i.item, i.findings.map((f) => f.code)]));

test('a made item needs a BOM and a routing; with both and good parts it is complete', () => {
  const items = [it('A'), it('B'), it('C'), it('P', 'Buy')];
  const r = run(items, [b('A', 'P'), b('C', 'P')], [rt('A'), rt('B')]);
  assert.deepEqual(by(r), { A: [], B: ['no_bom'], C: ['no_routing'] });
});

test('obsolete, unknown and zero-quantity components are each named', () => {
  const r = run([it('A'), it('OLD', 'Buy', 'Obsolete'), it('P', 'Buy')], [b('A', 'OLD'), b('A', 'NEW-1'), b('A', 'P', 0)], [rt('A')]);
  assert.deepEqual(by(r).A.sort(), ['component_inactive', 'component_unknown', 'zero_qty']);
});

test('routing steps need a work center and some time', () => {
  const r = run([it('A'), it('P', 'Buy')], [b('A', 'P')], [rt('A', '10', ''), rt('A', '20', 'WC', 0, 0)]);
  assert.deepEqual(by(r).A, ['routing_no_work_center', 'routing_no_time']); assert.equal(r.items[0].status, 'review');
});

test('a loop is flagged on every item in it; a deep chain without a loop is not', () => {
  assert.deepEqual(by(run([it('A'), it('B')], [b('A', 'B'), b('B', 'A')], [rt('A'), rt('B')])), { A: ['circular_bom'], B: ['circular_bom'] });
  assert.deepEqual(by(run([it('A'), it('B'), it('C', 'Buy')], [b('A', 'B'), b('B', 'C')], [rt('A'), rt('B')])), { A: [], B: [] });
});

test('a bought item with a BOM is watched; a parent missing from the master is reviewed; obsolete made items are skipped', () => {
  const r = run([it('S', 'Buy'), it('R', 'Buy'), it('X', 'Make', 'Obsolete')], [b('S', 'R'), b('K', 'R')], []);
  assert.deepEqual(by(r), { K: ['parent_unknown'], S: ['buy_with_bom'] });
});

test('make and buy words come from settings', () => {
  const r = run([it('A', 'Produced'), it('B', 'Make')], [], [], { ...DEFAULTS, make_words: ['produced'] });
  assert.deepEqual(by(r), { A: ['no_bom', 'no_routing'] });
});

test('the fix list names every problem and leaves the owner to confirm', () => {
  const d = fixListText(run([it('A')], [], []), {});
  assert.match(d, /\| A \| no_bom \|/); assert.match(d, /\| A \| no_routing \|/); assert.match(d, /\[TO CONFIRM engineering or ERP data owner\]/);
});
