// Labor efficiency: earned against direct, indirect share, one-sided hours or output, settings, masking.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { laborEfficiency, standardsReviewText, DEFAULTS } from '../src/index.js';

const l = (entry, work_center, work_order, hours, indirect = 'N', employee = 'Pat Worker') => ({ entry, employee, work_center, work_order, labor_date: '2026-11-02', hours, indirect });
const e = (work_order, work_center, qty_completed, std_hours_per_unit) => ({ work_order, work_center, qty_completed, std_hours_per_unit });
const run = (labor, earned, s = DEFAULTS) => laborEfficiency({ labor, earned }, s);
const by = (r) => Object.fromEntries(r.items.map((i) => [i.work_center, i.findings.map((f) => f.code)]));

test('efficiency is earned standard hours over direct hours; below target is flagged', () => {
  const r = run([l('1', 'A', 'W1', 10)], [e('W1', 'A', 16, 0.5)]);
  assert.equal(r.items[0].efficiency_pct, 80); assert.deepEqual(by(r), { A: ['low_efficiency'] });
  assert.deepEqual(by(run([l('1', 'A', 'W1', 10)], [e('W1', 'A', 18, 0.5)])), { A: [] });
});

test('far above target is watched as a possibly loose standard', () => {
  const r = run([l('1', 'A', 'W1', 10)], [e('W1', 'A', 30, 0.5)]);
  assert.deepEqual(by(r), { A: ['high_efficiency'] }); assert.equal(r.items[0].status, 'watch');
});

test('indirect hours are kept out of efficiency and reviewed when their share is high', () => {
  const r = run([l('1', 'A', 'W1', 10), l('2', 'A', '', 3, 'Yes')], [e('W1', 'A', 20, 0.5)]);
  assert.equal(r.items[0].efficiency_pct, 100); assert.deepEqual(by(r), { A: ['high_indirect'] });
});

test('hours with no completions and completions with no hours are named by work order', () => {
  const r = run([l('1', 'A', 'W1', 10), l('2', 'A', 'W2', 2)], [e('W1', 'A', 20, 0.5), e('W3', 'A', 4, 0.5)]);
  const f = r.items[0].findings.map((x) => x.detail).join(' ');
  assert.match(f, /hours on W2 with no completions/); assert.match(f, /completed W3 with no hours/);
});

test('a work center only in completions still appears, with no efficiency', () => {
  const r = run([], [e('W9', 'SAW', 5, 0.2)]);
  assert.deepEqual(by(r), { SAW: ['output_no_hours'] }); assert.equal(r.items[0].efficiency_pct, null);
});

test('targets come from settings', () => {
  assert.deepEqual(by(run([l('1', 'A', 'W1', 10)], [e('W1', 'A', 16, 0.5)], { ...DEFAULTS, min_efficiency_pct: 75 })), { A: [] });
});

test('results and the draft talk about work centers, never people', () => {
  const r = run([l('1', 'A', 'W1', 10, 'N', 'Quinn Fictional')], [e('W1', 'A', 10, 0.5)]);
  assert.doesNotMatch(JSON.stringify(r), /Quinn Fictional/);
  const d = standardsReviewText(r, {}); assert.match(d, /not any one person/); assert.doesNotMatch(d, /Quinn/);
});
