// Injury log completeness: fields, outcomes against days, caps, privacy, open cases, late entries, rates, masking.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentRuntime } from 'fairmake-core';
import { manifest, oshaLog, correctionListText, DEFAULTS } from '../src/index.js';

const c = (over = {}) => ({ case_number: 'C1', employee: 'Pat Worker', job_title: 'Operator', incident_date: '2026-03-01', entered_date: '2026-03-02', location: 'Cell 1', description: 'Cut', injury_type: 'Injury', outcome: 'Other recordable', days_away: 0, days_restricted: 0, privacy_case: 'N', recordable: 'Y', return_date: null, ...over });
const run = (rows, s = DEFAULTS) => oshaLog(rows, s);
const codes = (r) => r.items[0].findings.map((f) => f.code);

test('a complete case has no findings; a recordable case missing fields is reviewed', () => {
  assert.deepEqual(codes(run([c()])), []);
  assert.deepEqual(codes(run([c({ location: '', description: '' })])), ['missing_field']);
  assert.deepEqual(codes(run([c({ location: '', recordable: 'N', outcome: 'First aid' })])), [], 'not recordable: fields are not required');
});

test('day counts must agree with the outcome', () => {
  assert.deepEqual(codes(run([c({ days_away: 4, return_date: '2026-03-05' })])), ['outcome_days_mismatch']);
  assert.deepEqual(codes(run([c({ outcome: 'Days away', return_date: '2026-03-03' })])), ['days_missing']);
});

test('days over the cap are reviewed and counted at the cap', () => {
  const r = run([c({ outcome: 'Days away', days_away: 200, return_date: '2026-10-01' })]);
  assert.deepEqual(codes(r), ['days_over_cap']); assert.equal(r.days_away, 180);
});

test('a privacy case must not carry a name; days-away cases without a return date are open', () => {
  assert.deepEqual(codes(run([c({ privacy_case: 'Yes' })])), ['privacy_name_on_log']);
  assert.deepEqual(codes(run([c({ privacy_case: 'Yes', employee: 'Privacy case' })])), []);
  assert.deepEqual(codes(run([c({ outcome: 'Days away', days_away: 3 })])), ['open_case']);
});

test('late entries and first-aid cases marked recordable are reviewed', () => {
  assert.deepEqual(codes(run([c({ entered_date: '2026-03-20' })])), ['late_entry']);
  assert.deepEqual(codes(run([c({ outcome: 'First aid' })])), ['first_aid_recordable']);
});

test('rates per 200,000 hours only when hours are set', () => {
  const rows = [c(), c({ case_number: 'C2', outcome: 'Days away', days_away: 2, return_date: '2026-03-04' })];
  assert.equal(run(rows).trir, null);
  const r = run(rows, { ...DEFAULTS, annual_hours: 100000 }); assert.equal(r.trir, 4); assert.equal(r.dart_rate, 2);
});

test('names are masked in what the tools return, and the correction list uses case numbers only', async () => {
  const root = mkdtempSync(join(tmpdir(), 'osha-')); writeFileSync(join(root, 'c.csv'), ['case_number,employee,outcome,privacy_case', 'C1,Quinn Fictional,Days away,Y', ''].join('\n'));
  const r = await new AgentRuntime(manifest, { root, audit: false }).call('osha_log_check', { cases: 'c.csv' });
  assert.equal(r.status, 'executed', r.reason); assert.doesNotMatch(JSON.stringify(r), /Quinn Fictional/);
  assert.doesNotMatch(correctionListText(run([c({ privacy_case: 'Y' })]), {}), /Pat Worker/);
});
