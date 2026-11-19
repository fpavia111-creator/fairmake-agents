// Tariff codes: gaps, format, the code list, origins, entry lines, duty rates, same description under two headings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htsCodes, brokerQueryText, DEFAULTS } from '../src/index.js';

const it = (item, hts_code = '7318.15.2065', over = {}) => ({ item, description: `Item ${item}`, hts_code, country_of_origin: 'CN', supplier: 'S', ...over });
const en = (entry_line, item, hts_code = '7318.15.2065', over = {}) => ({ entry_line, item, hts_code, country_of_origin: 'CN', duty_rate: null, entered_value: 1000, ...over });
const run = (items, entries = [], s = DEFAULTS) => htsCodes({ items, entries }, s);
const by = (r) => Object.fromEntries(r.items.map((i) => [i.item, i.findings.map((f) => f.code)]));

test('no code is flagged; a code that is not 6, 8 or 10 digits is reviewed; dots and spaces do not matter', () => {
  assert.deepEqual(by(run([it('A', ''), it('B', '7318.1'), it('C', '7318 15 2065')])), { A: ['missing_hts'], B: ['hts_format'], C: [] });
});

test('with a code list, codes outside it are reviewed; missing origin is reviewed', () => {
  const s = { codes: { '7318.15.2065': { duty_pct: 0 } } };
  assert.deepEqual(by(run([it('A', '7318.16.0085'), it('B', '7318.15.2065', { country_of_origin: '' })], [], s)), { A: ['hts_not_in_list'], B: ['missing_coo'] });
});

test('an entry declared under another code is flagged; another origin is reviewed', () => {
  assert.deepEqual(by(run([it('A')], [en('E1', 'A', '7318.16.0085'), en('E2', 'a', '7318.15.2065', { country_of_origin: 'VN' })])), { A: ['entry_hts_differs', 'entry_coo_differs'] });
});

test('a duty rate different from the list is flagged at the difference on the entered value', () => {
  const r = run([it('A')], [en('E1', 'A', '7318.15.2065', { duty_rate: 25, entered_value: 2000 })], { codes: { '7318.15.2065': { duty_pct: 0 } } });
  assert.deepEqual(r.items[0].findings.map((f) => [f.code, f.amount]), [['duty_rate_differs', 500]]); assert.equal(r.duty_difference, 500);
});

test('the same description under different six-digit headings is watched on both items', () => {
  const r = run([it('A', '7318.15.2065', { description: 'Hex bolt' }), it('B', '7318.16.0085', { description: 'HEX BOLT' }), it('C', '7318.15.2090', { description: 'Hex bolt' })]);
  assert.deepEqual(by(r), { A: ['same_description_split'], B: ['same_description_split'], C: ['same_description_split'] });
});

test('entered items missing from the item master are listed', () => {
  assert.deepEqual(run([it('A')], [en('E1', 'Z')]).entry_items_not_in_master, ['Z']);
});

test('the broker query asks, and says nothing was changed', () => {
  const d = brokerQueryText(run([it('A', '')]), {});
  assert.match(d, /\| A \|/); assert.match(d, /we have not changed anything/); assert.match(d, /\[TO CONFIRM customs broker contact\]/);
});
