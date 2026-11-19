// NCR and CAPA aging: limits, dispositions, CAPA links, due dates, root causes, verification, repeat defects, masking.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentRuntime } from 'fairmake-core';
import { manifest, ncrCapa, capaReminderText, DEFAULTS } from '../src/index.js';

const n = (ncr, over = {}) => ({ ncr, opened: '2026-11-10', closed: null, part: 'P', supplier: '', defect_code: 'D', disposition: 'Rework', capa: '', ncr_status: 'Open', owner: 'Owner Person', ...over });
const c = (capa, over = {}) => ({ capa, opened: '2026-11-01', due: '2026-12-31', closed: null, root_cause: 'Cause', verified: '', capa_status: 'Open', owner: 'Owner Person', ...over });
const run = (ncrs, capas = [], s = DEFAULTS) => ncrCapa({ ncrs, capas }, s, '2026-11-18');
const by = (r) => Object.fromEntries(r.items.map((i) => [i.id, i.findings.map((f) => f.code)]));

test('an NCR open past the limit is overdue; closing it stops the clock', () => {
  assert.deepEqual(by(run([n('N1', { opened: '2026-09-01' })])), { N1: ['ncr_overdue'] });
  assert.deepEqual(by(run([n('N1', { opened: '2026-09-01', closed: '2026-09-10', ncr_status: 'Closed' })])), { N1: [] });
});

test('a disposition is expected once an NCR is a week old or closed', () => {
  assert.deepEqual(by(run([n('N1', { disposition: '' })])), { N1: ['no_disposition'] });
  assert.deepEqual(by(run([n('N1', { disposition: '', opened: '2026-11-15' })])), { N1: [] });
});

test('an NCR pointing at a CAPA not in the log is reviewed', () => {
  assert.deepEqual(by(run([n('N1', { capa: 'C9' })], [c('C1')])), { C1: [], N1: ['capa_not_found'] });
});

test('CAPAs: overdue, no root cause, closed without verification', () => {
  const r = run([], [c('C1', { due: '2026-11-01' }), c('C2', { root_cause: '', opened: '2026-10-01' }), c('C3', { closed: '2026-11-05', capa_status: 'Closed', verified: 'N' }), c('C4', { closed: '2026-11-05', capa_status: 'Closed', verified: 'Yes' })]);
  assert.deepEqual(by(r), { C1: ['capa_overdue'], C2: ['no_root_cause'], C3: ['closed_unverified'], C4: [] });
});

test('the same part and defect the repeat number of times with no CAPA is flagged on the latest NCR only', () => {
  const r = run([n('N1', { opened: '2026-11-01' }), n('N2', { opened: '2026-11-05' }), n('N3', { opened: '2026-11-12' })]);
  assert.deepEqual(by(r), { N1: [], N2: [], N3: ['repeat_without_capa'] });
  assert.deepEqual(run([n('N1'), n('N2'), n('N3', { capa: 'C1' })], [c('C1')]).repeat_defects, []);
});

test('owner names are masked in what the tools return, by initials and a short hash', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ncr-')); writeFileSync(join(root, 'n.csv'), ['ncr,opened,owner,ncr_status', 'N1,2026-09-01,Owner Person,Open', ''].join('\n'));
  const r = await new AgentRuntime(manifest, { root, audit: false }).call('ncr_check', { ncrs: 'n.csv', as_of: '2026-11-18' });
  assert.equal(r.status, 'executed', r.reason); assert.doesNotMatch(JSON.stringify(r), /Owner Person/); assert.match(r.result.items[0].owner, /^O.P.#[0-9a-f]{6}$/);
});

test('the reminder lists records needing action and closes nothing', () => {
  const d = capaReminderText(run([n('N1', { opened: '2026-09-01' }), n('N2')]), {});
  assert.match(d, /\| N1 \| ncr \|/); assert.doesNotMatch(d, /\| N2 \|/); assert.match(d, /this note closes nothing/);
});
