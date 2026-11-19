// Calibration: due dates, look-ahead, suspect product after a failed or overdue calibration, retired gauges, the calendar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRuntime } from 'fairmake-core';
import { manifest, calibrationStatus, suspectNoticeText, DEFAULTS } from '../src/index.js';

const g = (over = {}) => ({ gauge: 'G1', description: 'Mic', location: 'Lab', last_cal: '2026-06-01', interval_days: 365, cal_result: 'Pass', gauge_status: 'Active', ...over });
const u = (work_order, used_date, gauge = 'G1') => ({ gauge, work_order, used_date });
const run = (gauges, usage = [], s = DEFAULTS) => calibrationStatus({ gauges, usage }, s, '2026-11-18');
const codes = (r) => r.items[0].findings.map((f) => f.code);

test('overdue past last calibration plus interval; due soon inside the look-ahead', () => {
  assert.deepEqual(codes(run([g({ last_cal: '2025-11-01' })])), ['overdue']);
  assert.deepEqual(codes(run([g({ last_cal: '2025-12-01' })])), ['due_soon']);
  assert.deepEqual(codes(run([g()])), []);
});

test('use after a failed calibration names the work orders; use before it does not', () => {
  const r = run([g({ last_cal: '2026-11-01', cal_result: 'Fail' })], [u('W1', '2026-10-20'), u('W2', '2026-11-05')]);
  assert.deepEqual(codes(r), ['failed_then_used']); assert.deepEqual(r.suspect.map((x) => x.work_order), ['W2']);
});

test('use past the due date is suspect, and is listed once', () => {
  const r = run([g({ last_cal: '2025-11-01' })], [u('W1', '2026-10-30'), u('W2', '2026-11-05')]);
  assert.deepEqual(codes(r), ['overdue', 'used_while_overdue']); assert.deepEqual(r.suspect.map((x) => [x.work_order, x.why]), [['W2', 'used while overdue']]);
});

test('never calibrated and no interval are reviewed; an out-of-service gauge is not chased', () => {
  assert.deepEqual(codes(run([g({ last_cal: null })])), ['never_calibrated']);
  assert.deepEqual(codes(run([g({ interval_days: null })])), ['no_interval']);
  assert.deepEqual(codes(run([g({ last_cal: '2024-01-01', gauge_status: 'Retired' })])), []);
});

test('the look-ahead comes from settings', () => {
  assert.deepEqual(codes(run([g({ last_cal: '2025-12-01' })], [], { due_soon_days: 7 })), []);
});

test('the report writes a calendar of due dates for gauges in service', async () => {
  const root = mkdtempSync(join(tmpdir(), 'cal-')); cpSync(fileURLToPath(new URL('../fixtures', import.meta.url)), root, { recursive: true });
  const r = await new AgentRuntime(manifest, { root, audit: false }).call('calibration_write_report', { gauges: 'gauges.csv', usage: 'usage.csv', as_of: '2026-11-18' });
  assert.equal(r.status, 'executed', r.reason); const ics = readFileSync(join(root, r.result.files[2]), 'utf8');
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 6); assert.match(ics, /Calibration overdue: CAL-003/); assert.doesNotMatch(ics, /CMM-007/);
});

test('the suspect-product note lists every suspect measurement and says no customer is told', () => {
  const r = run([g({ last_cal: '2026-11-01', cal_result: 'Out of tolerance' })], [u('W7', '2026-11-03')]);
  const d = suspectNoticeText(r, {}); assert.match(d, /\| G1 \| W7 \| 2026-11-03 \| used after a failed calibration \|/); assert.match(d, /tells no customer anything/);
});
