// Preventive maintenance: due dates from the last completion, meters, look-ahead, missing data, the calendar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRuntime } from 'fairmake-core';
import { manifest, pmStatus, pmWorkOrderText, DEFAULTS } from '../src/index.js';

const task = (over = {}) => ({ task: 'T1', asset: 'M1', description: 'Grease', interval_days: 30, interval_hours: null, last_done: '2026-11-10', hours_since: null, critical: 'N', ...over });
const run = (schedule, completions = [], s = DEFAULTS) => pmStatus({ schedule, completions }, s, '2026-11-18');
const codes = (r) => r.items[0].findings.map((f) => f.code);

test('due date is last done plus the interval; past it is overdue, within the look-ahead is due soon', () => {
  assert.deepEqual(codes(run([task({ last_done: '2026-10-01' })])), ['overdue']);
  assert.deepEqual(codes(run([task({ last_done: '2026-10-25' })])), ['due_soon']);
  assert.deepEqual(codes(run([task()])), []);
});

test('the latest completion wins, from the schedule or the completion log', () => {
  const r = run([task({ last_done: '2026-09-01' })], [{ task: 't1', done_date: '2026-11-10' }, { task: 'T1', done_date: '2026-08-01' }]);
  assert.equal(r.items[0].last_done, '2026-11-10'); assert.deepEqual(codes(r), []);
});

test('run hours past the meter interval are overdue even when the date is fine', () => {
  assert.deepEqual(codes(run([task({ interval_hours: 500, hours_since: 620 })])), ['meter_overdue']);
});

test('never done and no interval are reviewed; safety-critical overdue tasks are counted', () => {
  assert.deepEqual(codes(run([task({ last_done: null })])), ['never_done']);
  assert.deepEqual(codes(run([task({ interval_days: null })])), ['no_interval']);
  assert.equal(run([task({ last_done: '2026-09-01', critical: 'Yes' })]).critical_overdue, 1);
});

test('the look-ahead comes from settings', () => {
  assert.deepEqual(codes(run([task({ last_done: '2026-11-15' })], [], { due_soon_days: 30 })), ['due_soon']);
});

test('the report writes a calendar with one event per due task', async () => {
  const root = mkdtempSync(join(tmpdir(), 'pm-')); cpSync(fileURLToPath(new URL('../fixtures', import.meta.url)), root, { recursive: true });
  const r = await new AgentRuntime(manifest, { root, audit: false }).call('pm_write_report', { schedule: 'pm-schedule.csv', completions: 'completions.csv', as_of: '2026-11-18' });
  assert.equal(r.status, 'executed', r.reason); assert.equal(r.result.files.length, 3);
  const ics = readFileSync(r.result.files[2], 'utf8'); assert.match(ics, /PM overdue: CNC-2 Way cover inspection/); assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 8);
});

test('the PM list puts safety-critical tasks first', () => {
  const r = run([task({ task: 'A', last_done: '2026-09-01' }), task({ task: 'B', description: 'Guard check', last_done: '2026-09-01', critical: 'Y' })]);
  const d = pmWorkOrderText(r, {}); assert.ok(d.indexOf('Guard check') < d.indexOf('Grease')); assert.match(d, /\[TO CONFIRM maintenance lead\]/);
});
